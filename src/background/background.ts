import { CaptureOptions, Rect, PageInfo, CaptureResult, FontInfo, ColorInfo } from '../types';

interface CaptureRequest {
  options: CaptureOptions;
  tabId: number;
  windowId: number;
  url?: string;
  title?: string;
  visibleDataUrl: string | null; // pre-captured in popup while activeTab is active
}

interface TabState {
  selection: Rect | null;
  pageInfo: PageInfo | null;
  options: CaptureOptions | null;
  url?: string;
  title?: string;
  fullScreenDataUrl: string | null;
  originalWindow: {
    id: number;
    width?: number;
    height?: number;
    state?: chrome.windows.windowStateEnum;
  } | null;
}

const tabStates = new Map<number, TabState>();
let lastCaptureResult: CaptureResult | null = null;

// DevTools history state
const fontHistory: FontInfo[] = [];
const colorHistory: ColorInfo[] = [];
let activeFont: FontInfo | null = null;
let activeColor: ColorInfo | null = null;

function initTabState(tabId: number): TabState {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, {
      selection: null,
      pageInfo: null,
      options: null,
      fullScreenDataUrl: null,
      originalWindow: null,
    });
  }
  return tabStates.get(tabId)!;
}

function clearTransientTabState(state: TabState) {
  state.selection = null;
  state.pageInfo = null;
  state.options = null;
  state.url = undefined;
  state.title = undefined;
  state.fullScreenDataUrl = null;
}

function pruneTabState(tabId: number) {
  const state = tabStates.get(tabId);
  if (!state) return;

  if (
    !state.selection &&
    !state.pageInfo &&
    !state.options &&
    !state.fullScreenDataUrl &&
    !state.originalWindow
  ) {
    tabStates.delete(tabId);
  }
}

function hasPresetCapture(options: CaptureOptions) {
  return !!(options.devicePreset || options.customWidth || options.customHeight);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function restoreOriginalWindow(tabId: number, state: TabState) {
  if (!state.originalWindow) return;

  try {
    await chrome.windows.update(state.originalWindow.id, {
      width: state.originalWindow.width,
      height: state.originalWindow.height,
      state: state.originalWindow.state,
    });
  } catch (restoreErr) {
    console.warn('Failed to restore window dimension:', restoreErr);
  } finally {
    state.originalWindow = null;
    pruneTabState(tabId);
  }
}

async function cleanupPresetCapture(tabId: number, state: TabState, hasPreset: boolean) {
  if (hasPreset) {
    await removePresetEmulation(tabId);
  }

  await restoreOriginalWindow(tabId, state);
}

// ---------------------------------------------------------------------------
// Rate-limiter: Chrome's captureVisibleTab quota is 2 calls/second (token
// bucket). We enforce a 600 ms minimum gap between calls — safely under the
// 500 ms floor — and record lastCaptureTime AFTER the call returns so the
// timer is anchored to when Chrome actually finished processing it.
// ---------------------------------------------------------------------------
let lastCaptureTime = 0;
const MIN_CAPTURE_INTERVAL_MS = 600;

async function rateLimitedCapture(
  winId: number,
  format: string,
  quality: number
): Promise<string> {
  const elapsed = Date.now() - lastCaptureTime;
  if (elapsed < MIN_CAPTURE_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_CAPTURE_INTERVAL_MS - elapsed));
  }
  // Chrome only accepts 'png' | 'jpeg'. Fall back to 'png' for 'webp' —
  // the webp conversion happens later via canvas.
  const chromeFormat = (format === 'jpeg' ? 'jpeg' : 'png') as 'png' | 'jpeg';
  try {
    const result = await chrome.tabs.captureVisibleTab(winId, { format: chromeFormat, quality });
    // Record time AFTER the API call resolves so the interval is measured
    // from the end of one capture to the start of the next.
    lastCaptureTime = Date.now();
    return result;
  } catch (err: unknown) {
    if (err instanceof Error && (err.message?.includes('activeTab') || err.message?.includes('Cannot access') || err.message?.includes('Missing host permission'))) {
      throw new Error(`Cannot capture this page. Original error: ${err.message}`);
    }
    throw err;
  }
}


async function captureFullPage(tabId: number, windowId: number, options: CaptureOptions): Promise<string> {
  const state = initTabState(tabId);
  
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      return {
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth || 0
        ),
        scrollHeight: Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0
        ),
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
        devicePixelRatio: window.devicePixelRatio,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      };
    },
  });
  
  if (!results[0]?.result) {
    throw new Error('Failed to get page dimensions');
  }
  
  const pageInfo = results[0].result as PageInfo;
  state.pageInfo = pageInfo;
  
  const { scrollWidth, scrollHeight, clientHeight, devicePixelRatio } = pageInfo;
  
  const hasPreset = hasPresetCapture(options);
  let targetWidth = 0;
  if (hasPreset) {
    if (options.devicePreset) {
      const preset = options.devicePreset;
      targetWidth = options.orientation === 'landscape' ? preset.height : preset.width;
    } else {
      if (options.customWidth) targetWidth = options.customWidth;
    }
  }

  const canvasWidth = (hasPreset && targetWidth > 0) ? targetWidth : scrollWidth;
  const canvas = new OffscreenCanvas(canvasWidth * devicePixelRatio, scrollHeight * devicePixelRatio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context for full-page capture');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  
  const winId = windowId;
  const originalScrollX = pageInfo.scrollX || 0;
  const originalScrollY = pageInfo.scrollY || 0;

  // -------------------------------------------------------------------------
  // Hide fixed/sticky elements so they don't overlap in every scroll slice.
  // We store their original visibility and restore it afterward.
  // -------------------------------------------------------------------------
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const fixed: Array<{ el: Element; originalVisibility: string }> = [];
      document.querySelectorAll('*').forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          fixed.push({ el, originalVisibility: (el as HTMLElement).style.visibility });
          (el as HTMLElement).style.visibility = 'hidden';
        }
      });
      const w = window as unknown as Record<string, unknown>;
      w.__fixedHidden = fixed;
      // Pre-scroll to very top with instant behavior to start clean
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    },
  });

  // Small initial settle after hiding elements + scrolling to top
  await new Promise(resolve => setTimeout(resolve, 150));

  const scrollSteps = Math.ceil(scrollHeight / clientHeight);
  // Maximum the browser will actually scroll to
  const maxScrollY = Math.max(0, scrollHeight - clientHeight);
  // Track last drawn position to skip duplicate captures (page can't scroll further)
  let lastActualScrollY = -1;

  for (let step = 0; step < scrollSteps; step++) {
    // Clamp target to the true maximum scroll position so we never ask
    // the browser to scroll past the bottom of the page.
    const targetScrollY = Math.min(step * clientHeight, maxScrollY);

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (sy) => {
        window.scrollTo({ top: sy, left: 0, behavior: 'instant' as ScrollBehavior });
      },
      args: [targetScrollY],
    });

    // Wait long enough for complex pages (GitHub, SPAs, lazy-loaded content)
    // to finish repainting at the new scroll position.
    await new Promise(resolve => setTimeout(resolve, 200));

    // Read back the ACTUAL scroll position — the browser may have clamped it.
    const scrollResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.scrollY,
    });
    const actualScrollY: number = (scrollResult[0]?.result as number) ?? targetScrollY;

    // Skip this step if the page position hasn't changed (already at the bottom).
    if (actualScrollY === lastActualScrollY) continue;
    lastActualScrollY = actualScrollY;

    const dataUrl = await rateLimitedCapture(winId, 'png', 100);

    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // Use ACTUAL scroll position for canvas placement — not the intended target.
    // This is the core fix: if the browser clamped the scroll, we draw at the
    // real position so there is no gap or overlap in the stitched image.
    const drawY = actualScrollY * devicePixelRatio;
    const captureHeight = Math.min(clientHeight, scrollHeight - actualScrollY);

    ctx.drawImage(
      imageBitmap,
      0,
      0,
      canvasWidth * devicePixelRatio,
      captureHeight * devicePixelRatio,
      0,
      drawY,
      canvasWidth * devicePixelRatio,
      captureHeight * devicePixelRatio
    );
  }

  // Restore fixed/sticky elements
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const w = window as unknown as Record<string, unknown>;
      const fixed = w.__fixedHidden as Array<{ el: Element; originalVisibility: string }>;
      if (fixed) {
        fixed.forEach(({ el, originalVisibility }) => {
          (el as HTMLElement).style.visibility = originalVisibility;
        });
        delete w.__fixedHidden;
      }
    },
  });
  
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (ox, oy) => {
      window.scrollTo(ox, oy);
    },
    args: [originalScrollX, originalScrollY],
  });
  
  // PDF is generated in the popup from the PNG data — treat it as PNG here.
  if (options.format === 'png' || options.format === 'pdf') {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blobToDataUrl(blob);
  }
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasWidth;
  tempCanvas.height = scrollHeight;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) throw new Error('Failed to get 2D context for format conversion');
  
  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  const img = await createImageBitmap(pngBlob);
  
  tempCtx.drawImage(img, 0, 0, canvasWidth, scrollHeight);
  
  const finalBlob = await new Promise<Blob>((resolve, reject) => {
    tempCanvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Failed to convert')),
      `image/${options.format}`,
      options.quality / 100
    );
  });
  
  return blobToDataUrl(finalBlob);
}

async function captureSelectedArea(selection: Rect, options: CaptureOptions, fullScreenDataUrl: string, scrollInfo: { scrollX: number; scrollY: number; devicePixelRatio: number }): Promise<string> {
  const { scrollX, scrollY, devicePixelRatio } = scrollInfo;
  
  const captureX = selection.x - scrollX;
  const captureY = selection.y - scrollY;
  
  const dataUrl = fullScreenDataUrl;
  
  const canvas = new OffscreenCanvas(selection.width * devicePixelRatio, selection.height * devicePixelRatio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context for selected area capture');
  
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  
  ctx.drawImage(
    imageBitmap,
    captureX * devicePixelRatio,
    captureY * devicePixelRatio,
    selection.width * devicePixelRatio,
    selection.height * devicePixelRatio,
    0,
    0,
    selection.width * devicePixelRatio,
    selection.height * devicePixelRatio
  );
  
  const resultBlob = await canvas.convertToBlob({ type: `image/${options.format}`, quality: options.quality / 100 });
  return blobToDataUrl(resultBlob);
}

async function injectPresetEmulation(tabId: number, width: number) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (w) => {
        const style = document.createElement('style');
        style.id = 'fullscreen-preset-emulation';
        style.innerHTML = `
          html, body {
            width: ${w}px !important;
            max-width: ${w}px !important;
            min-width: ${w}px !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            box-sizing: border-box !important;
          }
        `;
        document.documentElement.appendChild(style);

        Object.defineProperty(window, 'innerWidth', { get: () => w, configurable: true });
        try {
          Object.defineProperty(window.screen, 'width', { get: () => w, configurable: true });
        } catch {
          // window.screen.width may be non-configurable in some contexts
        }
        window.dispatchEvent(new Event('resize'));
      },
      args: [width],
    });
  } catch (err) {
    console.warn('Failed to inject preset emulation styling:', err);
  }
}

async function removePresetEmulation(tabId: number) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const style = document.getElementById('fullscreen-preset-emulation');
        if (style) style.remove();
        
        const w2 = window as unknown as Record<string, unknown>;
        const s = window.screen as unknown as Record<string, unknown>;
        delete w2.innerWidth;
        delete s.width;
        window.dispatchEvent(new Event('resize'));
      },
    });
  } catch (err) {
    console.warn('Failed to remove preset emulation styling:', err);
  }
}

async function startSelection(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'START_SELECTION' });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message?.includes('activeTab') || err.message?.includes('Cannot access') || err.message?.includes('Missing host permission'))) {
      throw new Error(`Cannot capture this page. Original error: ${err.message}`);
    }
    throw err;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE') {
    const { options, tabId, windowId, visibleDataUrl } = message.payload as CaptureRequest;
    
    (async () => {
      let isResized = false;
      const state = initTabState(tabId);

      clearTransientTabState(state);

      const hasPreset = hasPresetCapture(options);
      let targetWidth = 0;
      let targetHeight = 0;

      try {
        if (hasPreset) {
          try {
            const originalWin = await chrome.windows.get(windowId);
            state.originalWindow = {
              id: windowId,
              width: originalWin.width,
              height: originalWin.height,
              state: originalWin.state,
            };
            
            targetWidth = originalWin.width || 1200;
            targetHeight = originalWin.height || 800;
            
            if (options.devicePreset) {
              const preset = options.devicePreset;
              targetWidth = options.orientation === 'landscape' ? preset.height : preset.width;
              targetHeight = options.orientation === 'landscape' ? preset.width : preset.height;
            } else {
              if (options.customWidth) targetWidth = options.customWidth;
              if (options.customHeight) targetHeight = options.customHeight;
            }
            
            await chrome.windows.update(windowId, {
              state: 'normal',
              width: targetWidth,
              height: targetHeight
            });
            isResized = true;

            // Emulate device viewport inside document
            await injectPresetEmulation(tabId, targetWidth);
            
            // Wait for layout rendering to complete
            await new Promise(resolve => setTimeout(resolve, 800));
          } catch (err) {
            console.warn('Failed to resize window for preset:', err);
          }
        }

        let dataUrl: string;
        let width: number;
        let height: number;
        
        switch (options.mode) {
          case 'visible': {
            let dataUrlToUse = visibleDataUrl;
            if (isResized) {
              dataUrlToUse = await rateLimitedCapture(windowId, 'png', 100);
            }
            if (!dataUrlToUse) throw new Error('No visible capture provided');
            dataUrl = dataUrlToUse;
            const info = await chrome.scripting.executeScript({
              target: { tabId },
              func: () => ({
                width: document.documentElement.clientWidth,
                height: document.documentElement.clientHeight,
                devicePixelRatio: window.devicePixelRatio,
              }),
            });
            const infoResult = info[0].result as { width: number; height: number; devicePixelRatio: number };
            const clientWidth = infoResult.width;
            const clientHeight = infoResult.height;
            const dpr = infoResult.devicePixelRatio;
            
            if (hasPreset && targetWidth > 0) {
              const canvas = new OffscreenCanvas(targetWidth * dpr, clientHeight * dpr);
              const ctx = canvas.getContext('2d');
              if (!ctx) throw new Error('Failed to get 2D context for preset visible capture');
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              const img = await createImageBitmap(blob);
              ctx.drawImage(
                img,
                0,
                0,
                targetWidth * dpr,
                clientHeight * dpr,
                0,
                0,
                targetWidth * dpr,
                clientHeight * dpr
              );
              const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
              dataUrl = await blobToDataUrl(resultBlob);
              width = targetWidth;
              height = clientHeight;
            } else {
              width = clientWidth;
              height = clientHeight;
            }
            break;
          }
          
          case 'fullpage': {
            dataUrl = await captureFullPage(tabId, windowId, options);
            const pageInfo = state.pageInfo!;
            width = pageInfo.scrollWidth;
            height = pageInfo.scrollHeight;
            break;
          }
          
          case 'selected': {
            state.options = options;
            state.url = message.payload.url;
            state.title = message.payload.title;

            let dataUrlToUse = visibleDataUrl;
            if (isResized) {
              dataUrlToUse = await rateLimitedCapture(windowId, 'png', 100);
            }
            state.fullScreenDataUrl = dataUrlToUse;

            await startSelection(tabId);
            sendResponse({ waiting: true });
            return;
          }
          
          default:
            throw new Error(`Unknown mode: ${options.mode}`);
        }
        
        const captureData = {
          dataUrl,
          width,
          height,
          format: options.format,
          url: message.payload.url,
          title: message.payload.title,
        };
        lastCaptureResult = captureData as CaptureResult;
        
        chrome.tabs.create({ url: chrome.runtime.getURL('result.html') });
        
        sendResponse({
          result: captureData,
        });
      } catch (error) {
        sendResponse({ error: (error as Error).message });
      } finally {
        if (options.mode !== 'selected') {
          clearTransientTabState(state);
          await cleanupPresetCapture(tabId, state, hasPreset && isResized);
          pruneTabState(tabId);
        }
      }
    })();
    
    return true;
  }
  
  if (message.type === 'SELECTION_COMPLETE') {
    const payload = message.payload as { rect: Rect | null; scrollX: number; scrollY: number; devicePixelRatio: number };
    if (payload.rect && sender.tab?.id) {
      const tabId = sender.tab.id;
      const state = initTabState(tabId);
      state.selection = payload.rect;
      
      // Resume capture
      if (state.options && state.fullScreenDataUrl) {
        (async () => {
          try {
            const dataUrl = await captureSelectedArea(state.selection!, state.options!, state.fullScreenDataUrl!, {
              scrollX: payload.scrollX,
              scrollY: payload.scrollY,
              devicePixelRatio: payload.devicePixelRatio,
            });
            const captureData = {
              dataUrl,
              width: state.selection!.width,
              height: state.selection!.height,
              format: state.options!.format,
              url: state.url,
              title: state.title,
            };
            lastCaptureResult = captureData as CaptureResult;
            chrome.tabs.create({ url: chrome.runtime.getURL('result.html') });
          } catch (error) {
            console.error('Failed to capture selected area:', error);
          } finally {
            const shouldRemovePreset = !!state.originalWindow;
            clearTransientTabState(state);
            await cleanupPresetCapture(tabId, state, shouldRemovePreset);
            pruneTabState(tabId);
          }
        })();
      }
    }
    return false;
  }
  
  if (message.type === 'SELECTION_CANCELLED') {
    if (sender.tab?.id) {
      const tabId = sender.tab.id;
      const state = initTabState(tabId);
      
      (async () => {
        const shouldRemovePreset = !!state.originalWindow;
        clearTransientTabState(state);
        await cleanupPresetCapture(tabId, state, shouldRemovePreset);
        pruneTabState(tabId);
      })();
    }
    return false;
  }
  
  if (message.type === 'DELETE_CAPTURE') {
    lastCaptureResult = null;
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'GET_LATEST_CAPTURE') {
    sendResponse({ result: lastCaptureResult });
    return false;
  }

  // Store font detection results and forward to popup
  if (message.type === 'FONT_DETECTED') {
    activeFont = message.data;
    if (activeFont) {
      // Avoid duplicate family additions at the top
      const existsIdx = fontHistory.findIndex(f => f.fontFamily === activeFont!.fontFamily && f.fontSize === activeFont!.fontSize);
      if (existsIdx !== -1) fontHistory.splice(existsIdx, 1);
      fontHistory.unshift(activeFont);
      if (fontHistory.length > 10) fontHistory.pop();
    }
    chrome.runtime.sendMessage(message).catch(() => {
      // Catch error when popup is closed and no listener exists
    });
    return false;
  }

  // Handle adding color to history
  if (message.type === 'ADD_COLOR_HISTORY') {
    activeColor = message.color;
    if (activeColor) {
      const existsIdx = colorHistory.findIndex(c => c.hex.toLowerCase() === activeColor!.hex.toLowerCase());
      if (existsIdx !== -1) colorHistory.splice(existsIdx, 1);
      colorHistory.unshift(activeColor);
      if (colorHistory.length > 20) colorHistory.pop();
    }
    sendResponse({ success: true });
    return false;
  }

  // Get current DevTools state (history + active items)
  if (message.type === 'GET_DEVTOOLS_STATE') {
    sendResponse({
      fontHistory,
      colorHistory,
      activeFont,
      activeColor,
    });
    return false;
  }

  // Forward font/color tool messages from popup to active tab's content script
  if (message.type === 'DETECT_FONTS_START' || message.type === 'DETECT_FONTS_STOP' || message.type === 'PICK_COLOR') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, message, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
              sendResponse({ error: err.message });
            } else {
              sendResponse(response);
            }
          });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      } catch (err) {
        sendResponse({ error: (err as Error).message });
      }
    })();
    return true;
  }
  
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://devtools-ext.vercel.app' });
  }
});

export {};
