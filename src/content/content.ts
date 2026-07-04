import { Rect, FontInfo } from '../types';

(() => {
  // Prevent double-initialization of event listeners
  const w = window as unknown as Record<string, unknown>;
  if (w.__fullscreenShotInitialized) return;
  w.__fullscreenShotInitialized = true;

  let selectionOverlay: HTMLDivElement | null = null;
  let selectionRect: HTMLDivElement | null = null;
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let currentSelection: Rect | null = null;

  // Font detection state
  let isFontDetecting = false;
  let fontHighlightOverlay: HTMLDivElement | null = null;
  let fontTooltip: HTMLDivElement | null = null;
  let fontDetailPanel: HTMLDivElement | null = null;

  function handleEscapeKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({
        type: 'SELECTION_CANCELLED',
      });
    }
  }

  function createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'privacyshot-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      cursor: crosshair;
    `;
    return overlay;
  }

  function createSelectionRect(): HTMLDivElement {
    const rect = document.createElement('div');
    rect.id = 'privacyshot-selection';
    rect.style.cssText = `
      position: absolute;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      pointer-events: none;
    `;
    return rect;
  }

  function updateSelectionRect(x: number, y: number, width: number, height: number) {
    if (!selectionRect) return;
    selectionRect.style.left = `${x}px`;
    selectionRect.style.top = `${y}px`;
    selectionRect.style.width = `${Math.abs(width)}px`;
    selectionRect.style.height = `${Math.abs(height)}px`;
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    
    if (selectionRect) {
      selectionRect.style.left = `${startX}px`;
      selectionRect.style.top = `${startY}px`;
      selectionRect.style.width = '0';
      selectionRect.style.height = '0';
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isSelecting || !selectionRect) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const width = currentX - startX;
    const height = currentY - startY;
    
    const rectX = width < 0 ? currentX : startX;
    const rectY = height < 0 ? currentY : startY;
    
    updateSelectionRect(rectX, rectY, Math.abs(width), Math.abs(height));
  }

  function handleMouseUp(e: MouseEvent) {
    if (!isSelecting) return;
    isSelecting = false;
    
    const endX = e.clientX;
    const endY = e.clientY;
    
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    if (width > 5 && height > 5) {
      const rectX = Math.min(startX, endX);
      const rectY = Math.min(startY, endY);
      
      currentSelection = {
        x: rectX + window.scrollX,
        y: rectY + window.scrollY,
        width,
        height,
      };
    }
    
    cleanup();
    
    chrome.runtime.sendMessage({
      type: 'SELECTION_COMPLETE',
      payload: {
        rect: currentSelection,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio,
      }
    });
  }

  function cleanup() {
    document.removeEventListener('keydown', handleEscapeKey);
    if (selectionOverlay) {
      selectionOverlay.removeEventListener('mousedown', handleMouseDown);
      selectionOverlay.removeEventListener('mousemove', handleMouseMove);
      selectionOverlay.removeEventListener('mouseup', handleMouseUp);
      selectionOverlay.remove();
      selectionOverlay = null;
    }
    selectionRect = null;
  }

  function startSelection() {
    cleanup();
    
    selectionOverlay = createOverlay();
    selectionRect = createSelectionRect();
    
    selectionOverlay.appendChild(selectionRect);
    document.body.appendChild(selectionOverlay);
    
    selectionOverlay.addEventListener('mousedown', handleMouseDown);
    selectionOverlay.addEventListener('mousemove', handleMouseMove);
    selectionOverlay.addEventListener('mouseup', handleMouseUp);

    document.addEventListener('keydown', handleEscapeKey);
  }

  // ── Font Detection ────────────────────────────────────

  function startFontDetection() {
    if (isFontDetecting) return;
    isFontDetecting = true;
    
    document.addEventListener('mousemove', handleFontDetectMove, true);
    document.addEventListener('click', handleFontDetectClick, true);
    document.addEventListener('keydown', handleFontDetectEscape, true);
    
    // Create highlight overlay
    if (!fontHighlightOverlay) {
      fontHighlightOverlay = document.createElement('div');
      fontHighlightOverlay.id = 'devtools-font-highlight';
      fontHighlightOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        border: 1.5px solid #D7CFBE;
        background: rgba(215, 207, 190, 0.06);
        z-index: 2147483645;
        transition: all 0.08s ease-out;
        border-radius: 4px;
        display: none;
      `;
      document.body.appendChild(fontHighlightOverlay);
    }

    // Create live hovering tooltip
    if (!fontTooltip) {
      fontTooltip = document.createElement('div');
      fontTooltip.id = 'devtools-font-tooltip';
      fontTooltip.style.cssText = `
        position: fixed;
        pointer-events: none;
        background: #111111;
        color: #f2f2f2;
        border: 1px solid #2a2a2a;
        padding: 5px 8px;
        border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 10px;
        font-weight: 600;
        z-index: 2147483646;
        display: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        white-space: nowrap;
      `;
      document.body.appendChild(fontTooltip);
    }

    // Remove any existing detail panel when starting fresh
    if (fontDetailPanel) {
      fontDetailPanel.remove();
      fontDetailPanel = null;
    }
  }

  function stopFontDetection() {
    isFontDetecting = false;
    document.removeEventListener('mousemove', handleFontDetectMove, true);
    document.removeEventListener('click', handleFontDetectClick, true);
    document.removeEventListener('keydown', handleFontDetectEscape, true);
    
    if (fontHighlightOverlay) {
      fontHighlightOverlay.remove();
      fontHighlightOverlay = null;
    }
    if (fontTooltip) {
      fontTooltip.remove();
      fontTooltip = null;
    }
    if (fontDetailPanel) {
      fontDetailPanel.remove();
      fontDetailPanel = null;
    }
  }

  function handleFontDetectMove(e: MouseEvent) {
    if (!isFontDetecting) return;
    
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (!el || el === fontHighlightOverlay || el === fontTooltip || el === fontDetailPanel || fontDetailPanel?.contains(el)) {
      if (fontHighlightOverlay) fontHighlightOverlay.style.display = 'none';
      if (fontTooltip) fontTooltip.style.display = 'none';
      return;
    }
    
    const rect = el.getBoundingClientRect();
    if (fontHighlightOverlay) {
      fontHighlightOverlay.style.display = 'block';
      fontHighlightOverlay.style.left = rect.left + 'px';
      fontHighlightOverlay.style.top = rect.top + 'px';
      fontHighlightOverlay.style.width = rect.width + 'px';
      fontHighlightOverlay.style.height = rect.height + 'px';
    }

    if (fontTooltip) {
      const styles = window.getComputedStyle(el);
      const cleanFontFamily = styles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      fontTooltip.innerText = `${cleanFontFamily} · ${styles.fontSize}`;
      fontTooltip.style.display = 'block';
      fontTooltip.style.left = (e.clientX + 12) + 'px';
      fontTooltip.style.top = (e.clientY + 12) + 'px';
    }
  }

  function showToast(message: string) {
    const existing = document.getElementById('devtools-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'devtools-toast';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #111111;
      color: #f2f2f2;
      border: 1px solid #D7CFBE;
      border-radius: 8px;
      padding: 10px 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: devtoolsToastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

    // Ensure style sheet has keyframes
    if (!document.getElementById('devtools-toast-style')) {
      const style = document.createElement('style');
      style.id = 'devtools-toast-style';
      style.innerText = `
        @keyframes devtoolsToastIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes devtoolsToastOut {
          from { opacity: 1; transform: translate(-50%, 0); }
          to { opacity: 0; transform: translate(-50%, -10px); }
        }
      `;
      document.head.appendChild(style);
    }

    toast.innerHTML = `
      <span style="color: #3d9970; font-size: 13px;">✓</span>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'devtoolsToastOut 0.2s ease-out forwards';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  function handleFontDetectClick(e: MouseEvent) {
    if (!isFontDetecting) return;
    
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (!el) return;
    
    // If user clicked inside the detail panel, do not intercept or stop propagation
    if (el === fontDetailPanel || fontDetailPanel?.contains(el) || el === fontTooltip || el === fontHighlightOverlay) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const styles = window.getComputedStyle(el);
    const cleanFontFamily = styles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

    // Copy only the font name directly to clipboard
    navigator.clipboard.writeText(cleanFontFamily)
      .then(() => {
        showToast(`Font copied: ${cleanFontFamily}`);
      })
      .catch(err => console.error('Failed to auto-copy font name:', err));

    const fontInfo = {
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      letterSpacing: styles.letterSpacing,
      color: styles.color,
      fontStyle: styles.fontStyle,
      textTransform: styles.textTransform,
      element: el.tagName.toLowerCase(),
    };
    
    // Send to background thread to add to recent font history
    chrome.runtime.sendMessage({
      type: 'FONT_DETECTED',
      data: fontInfo,
    });

    // Create and display the in-page detailed inspector panel
    showFontDetailsPanel(fontInfo);
    
    // Pause hover detection while panel is open
    if (fontHighlightOverlay) fontHighlightOverlay.style.display = 'none';
    if (fontTooltip) fontTooltip.style.display = 'none';
  }

  function handleFontDetectEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      stopFontDetection();
    }
  }

  function showFontDetailsPanel(font: FontInfo) {
    if (fontDetailPanel) {
      fontDetailPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'devtools-font-detail-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 280px;
      background: #0a0a0a;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 16px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      color: #f2f2f2;
      animation: devtoolsFadeIn 0.2s ease-out;
      text-align: left;
    `;

    // Add CSS animations to the element
    const styleSheet = document.createElement('style');
    styleSheet.innerText = `
      @keyframes devtoolsFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .dt-prop-box {
        background: #111111;
        border: 1px solid #1f1f1f;
        border-radius: 6px;
        padding: 6px 10px;
      }
      .dt-lbl {
        font-size: 8px;
        color: #555;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 2px;
      }
      .dt-val {
        font-size: 11px;
        font-weight: 600;
        color: #f2f2f2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dt-copy-btn {
        width: 100%;
        background: #D7CFBE;
        color: #0a0a0a;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border: none;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: background 0.2s;
        margin-top: 10px;
      }
      .dt-copy-btn:hover {
        background: #ffffff;
      }
    `;
    document.head.appendChild(styleSheet);

    const cleanFontFamily = font.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f1f1f; padding-bottom: 10px; margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: 700; color: #D7CFBE; text-transform: uppercase; letter-spacing: 0.1em;">Font Inspector</span>
        <button id="dt-close-panel-btn" style="background: none; border: none; color: #555; cursor: pointer; font-size: 16px; font-weight: bold; line-height: 1;">&times;</button>
      </div>

      <div style="background: #111; border: 1px solid #1f1f1f; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 10px;">
        <p style="font-family: ${font.fontFamily}; font-size: 16px; margin: 0; color: #f2f2f2;">Sample Typography</p>
        <p style="font-size: 9px; color: #555; margin: 4px 0 0 0; font-family: monospace;">&lt;${font.element}&gt; · ${cleanFontFamily}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div class="dt-prop-box">
          <div class="dt-lbl">Family</div>
          <div class="dt-val" title="${font.fontFamily}">${cleanFontFamily}</div>
        </div>
        <div class="dt-prop-box">
          <div class="dt-lbl">Size</div>
          <div class="dt-val">${font.fontSize}</div>
        </div>
        <div class="dt-prop-box">
          <div class="dt-lbl">Weight</div>
          <div class="dt-val">${font.fontWeight}</div>
        </div>
        <div class="dt-prop-box">
          <div class="dt-lbl">Line Height</div>
          <div class="dt-val">${font.lineHeight}</div>
        </div>
        <div class="dt-prop-box">
          <div class="dt-lbl">Spacing</div>
          <div class="dt-val">${font.letterSpacing}</div>
        </div>
        <div class="dt-prop-box">
          <div class="dt-lbl">Color</div>
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${font.color}; border: 1px solid #2a2a2a; display: inline-block;"></span>
            <span class="dt-val" style="font-family: monospace;">${font.color}</span>
          </div>
        </div>
      </div>

      <button id="dt-copy-panel-btn" class="dt-copy-btn">Copy Font CSS</button>
    `;

    document.body.appendChild(panel);
    fontDetailPanel = panel;

    // Attach listeners inside the panel
    document.getElementById('dt-close-panel-btn')?.addEventListener('click', () => {
      // Exit font detection mode entirely when panel is closed
      stopFontDetection();
    });

    document.getElementById('dt-copy-panel-btn')?.addEventListener('click', () => {
      const cssString = `font-family: ${font.fontFamily};\nfont-size: ${font.fontSize};\nfont-weight: ${font.fontWeight};\nline-height: ${font.lineHeight};\nletter-spacing: ${font.letterSpacing};\ncolor: ${font.color};`;
      navigator.clipboard.writeText(cssString).then(() => {
        const btn = document.getElementById('dt-copy-panel-btn') as HTMLButtonElement;
        if (btn) {
          btn.innerText = 'Copied!';
          setTimeout(() => btn.innerText = 'Copy Font CSS', 1200);
        }
      });
    });
  }

  // ── Color Helpers ─────────────────────────────────────
  // Kept local: the content script is loaded as a classic (non-module) script,
  // so it cannot import a shared ES module without breaking. These mirror
  // src/utils/color.ts, which serves the popup bundle.

  function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgb(0, 0, 0)';
    return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
  }

  function hexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'hsl(0, 0%, 0%)';
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  function extractMetadata() {
    const getMeta = (query: string): string => {
      const el = document.querySelector(query);
      return el ? el.getAttribute('content') || '' : '';
    };

    const getAttr = (query: string, attr: string): string => {
      const el = document.querySelector(query);
      return el ? el.getAttribute(attr) || '' : '';
    };

    const robots = getMeta('meta[name="robots"]');
    const standard = {
      title: document.title || '',
      description: getMeta('meta[name="description"]') || getMeta('meta[property="description"]') || '',
      keywords: getMeta('meta[name="keywords"]') || '',
      author: getMeta('meta[name="author"]') || '',
      robots: robots || '',
      canonical: getAttr('link[rel="canonical"]', 'href') || '',
      language: document.documentElement.lang || getAttr('meta[http-equiv="content-language"]', 'content') || '',
      charset: getAttr('meta[charset]', 'charset') || getAttr('meta[http-equiv="Content-Type"]', 'content')?.split('charset=')?.[1] || document.characterSet || '',
      themeColor: getMeta('meta[name="theme-color"]') || '',
      viewport: getMeta('meta[name="viewport"]') || '',
    };

    const og = {
      title: getMeta('meta[property="og:title"]') || '',
      description: getMeta('meta[property="og:description"]') || '',
      image: getMeta('meta[property="og:image"]') || '',
      url: getMeta('meta[property="og:url"]') || '',
      type: getMeta('meta[property="og:type"]') || '',
      site_name: getMeta('meta[property="og:site_name"]') || '',
      locale: getMeta('meta[property="og:locale"]') || '',
      video: getMeta('meta[property="og:video"]') || '',
      audio: getMeta('meta[property="og:audio"]') || '',
    };

    const twitter = {
      title: getMeta('meta[name="twitter:title"]') || getMeta('meta[property="twitter:title"]') || '',
      description: getMeta('meta[name="twitter:description"]') || getMeta('meta[property="twitter:description"]') || '',
      image: getMeta('meta[name="twitter:image"]') || getMeta('meta[property="twitter:image"]') || '',
      card: getMeta('meta[name="twitter:card"]') || getMeta('meta[property="twitter:card"]') || '',
      site: getMeta('meta[name="twitter:site"]') || getMeta('meta[property="twitter:site"]') || '',
      creator: getMeta('meta[name="twitter:creator"]') || getMeta('meta[property="twitter:creator"]') || '',
    };

    const icons = {
      favicon: getAttr('link[rel="icon"]', 'href') || getAttr('link[rel="shortcut icon"]', 'href') || '/favicon.ico',
      appleTouchIcon: getAttr('link[rel="apple-touch-icon"]', 'href') || '',
      maskIcon: getAttr('link[rel="mask-icon"]', 'href') || '',
      shortcutIcon: getAttr('link[rel="shortcut icon"]', 'href') || '',
    };

    // Make icon URLs absolute
    for (const key in icons) {
      const k = key as keyof typeof icons;
      if (icons[k] && !icons[k].startsWith('http') && !icons[k].startsWith('data:')) {
        try {
          icons[k] = new URL(icons[k], window.location.href).href;
        } catch { /* ignore invalid URL */ }
      }
    }

    const alternateEls = document.querySelectorAll('link[rel="alternate"]');
    const alternates: { hreflang: string; href: string }[] = [];
    alternateEls.forEach(el => {
      const href = el.getAttribute('href');
      const hreflang = el.getAttribute('hreflang');
      if (href && hreflang) {
        let absHref = href;
        if (!href.startsWith('http') && !href.startsWith('data:')) {
          try {
            absHref = new URL(href, window.location.href).href;
          } catch { /* ignore */ }
        }
        alternates.push({ hreflang, href: absHref });
      }
    });

    const seo = {
      canonical: standard.canonical,
      alternates,
      index: !robots.toLowerCase().includes('noindex'),
      follow: !robots.toLowerCase().includes('nofollow'),
    };

    const pwa = {
      manifest: getAttr('link[rel="manifest"]', 'href') || '',
      themeColor: standard.themeColor,
      backgroundColor: getMeta('meta[name="background-color"]') || '',
    };

    if (pwa.manifest && !pwa.manifest.startsWith('http') && !pwa.manifest.startsWith('data:')) {
      try {
        pwa.manifest = new URL(pwa.manifest, window.location.href).href;
      } catch { /* ignore */ }
    }

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const structuredData: Record<string, unknown>[] = [];
    scripts.forEach(script => {
      try {
        const txt = script.textContent?.trim();
        if (txt) {
          const parsed = JSON.parse(txt);
          if (parsed) {
            structuredData.push(parsed);
          }
        }
      } catch { /* ignore */ }
    });

    return {
      standard,
      og,
      twitter,
      icons,
      seo,
      pwa,
      structuredData,
    };
  }

  // ── Message Listener ──────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'PING':
        sendResponse({ success: true });
        break;

      case 'GET_METADATA':
        try {
          const payload = extractMetadata();
          sendResponse({ data: payload });
        } catch (err) {
          sendResponse({ error: (err as Error).message || 'Failed to extract metadata' });
        }
        break;

      case 'START_SELECTION':
        startSelection();
        sendResponse({ success: true });
        break;

      case 'DETECT_FONTS_START':
        startFontDetection();
        sendResponse({ success: true });
        break;

      case 'DETECT_FONTS_STOP':
        stopFontDetection();
        sendResponse({ success: true });
        break;

      case 'PICK_COLOR':
        (async () => {
          try {
            if ('EyeDropper' in window) {
              const EyeDropperCtor = (window as unknown as {
                EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
              }).EyeDropper;
              const eyeDropper = new EyeDropperCtor();
              const result = await eyeDropper.open();
              const hex = result.sRGBHex;

              // Copy selected hex directly to clipboard immediately
              navigator.clipboard.writeText(hex).catch(err => console.error('Failed to auto-copy hex:', err));
              
              // Show toast on webpage confirming copy
              showToast(`Color copied: ${hex}`);

              const colorPayload = {
                hex,
                rgb: hexToRgb(hex),
                hsl: hexToHsl(hex),
                source: 'eyedropper' as const,
                timestamp: Date.now(),
              };

              // Persist directly to background script history since popup might close
              chrome.runtime.sendMessage({
                type: 'ADD_COLOR_HISTORY',
                color: colorPayload,
              });

              sendResponse({ hex });
            } else {
              sendResponse({ error: 'EyeDropper API not available in this browser' });
            }
          } catch (err) {
            sendResponse({ error: (err as Error).message || 'Color pick cancelled' });
          }
        })();
        return true; // Keep channel open for async EyeDropper response
    }
    
    return true;
  });
})();

export {};
