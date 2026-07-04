import { useState, useEffect, useCallback } from 'react';
import { ColorInfo } from '../types';

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

async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (injectErr) {
      console.error('Failed to inject content script:', injectErr);
      return false;
    }
  }
}

export default function ColorPicker() {
  const [isPicking, setIsPicking] = useState(false);
  const [currentColor, setCurrentColor] = useState<ColorInfo | null>(null);
  const [colorHistory, setColorHistory] = useState<ColorInfo[]>([]);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial history and active selection from background thread
    chrome.runtime.sendMessage({ type: 'GET_DEVTOOLS_STATE' }, (response) => {
      if (response) {
        if (response.colorHistory) setColorHistory(response.colorHistory);
        if (response.activeColor) setCurrentColor(response.activeColor);
      }
    });

    const handleMessage = (message: { type: string; color?: ColorInfo }) => {
      if (message.type === 'ADD_COLOR_HISTORY' && message.color) {
        setCurrentColor(message.color);
        setCopiedFormat('HEX');
        setTimeout(() => setCopiedFormat(null), 1500);
        chrome.runtime.sendMessage({ type: 'GET_DEVTOOLS_STATE' }, (response) => {
          if (response?.colorHistory) {
            setColorHistory(response.colorHistory);
          }
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleColorSelection = useCallback(async (hex: string) => {
    const color: ColorInfo = {
      hex,
      rgb: hexToRgb(hex),
      hsl: hexToHsl(hex),
      source: 'eyedropper',
      timestamp: Date.now(),
    };
    setCurrentColor(color);
    
    // Show "Copied!" feedback next to HEX format
    setCopiedFormat('HEX');
    setTimeout(() => setCopiedFormat(null), 1500);

    // Save history array inside background script so it stays persistent
    chrome.runtime.sendMessage({ type: 'ADD_COLOR_HISTORY', color }, () => {
      chrome.runtime.sendMessage({ type: 'GET_DEVTOOLS_STATE' }, (response) => {
        if (response?.colorHistory) {
          setColorHistory(response.colorHistory);
        }
      });
    });
  }, []);

  const pickColor = useCallback(async () => {
    setIsPicking(true);
    
    // First, try running EyeDropper directly in the popup context where the user gesture is present
    if ('EyeDropper' in window) {
      try {
        const EyeDropperCtor = (window as unknown as {
          EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
        }).EyeDropper;
        const eyeDropper = new EyeDropperCtor();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          // Copy selected hex directly to clipboard immediately
          navigator.clipboard.writeText(result.sRGBHex).catch(err => console.error(err));
          
          await handleColorSelection(result.sRGBHex);
          setIsPicking(false);
          return;
        }
      } catch (err) {
        console.warn('EyeDropper failed in popup context, trying tab context...', err);
      }
    }

    // Fallback: If not supported in popup or fails, send a message to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setIsPicking(false);
      return;
    }

    const isReady = await ensureContentScriptInjected(tab.id);
    if (!isReady) {
      setIsPicking(false);
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'PICK_COLOR' });
      if (response?.hex) {
        // Copy selected hex directly to clipboard immediately
        navigator.clipboard.writeText(response.hex).catch(err => console.error(err));
        
        await handleColorSelection(response.hex);
      }
    } catch (err) {
      console.error('Pick color via content script error:', err);
    } finally {
      setIsPicking(false);
    }
  }, [handleColorSelection]);

  const copyValue = useCallback((format: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 1500);
    });
  }, []);

  const selectFromHistory = useCallback((color: ColorInfo) => {
    setCurrentColor(color);
  }, []);

  const formats = currentColor
    ? [
        { label: 'HEX', value: currentColor.hex },
        { label: 'RGB', value: currentColor.rgb },
        { label: 'HSL', value: currentColor.hsl },
      ]
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Pick Color Button */}
      <div>
        <button
          onClick={pickColor}
          disabled={isPicking}
          className={`w-full h-12 rounded-xl text-[13px] font-bold tracking-wide flex items-center justify-center gap-3
            transition-all duration-300 relative group overflow-hidden
            ${isPicking
              ? 'bg-[#111] border border-[#222] text-text-tertiary cursor-not-allowed'
              : 'bg-accent text-[#0a0a0a] border-transparent hover:bg-white active:scale-95 shadow-[0_0_15px_rgba(215,207,190,0.2)] hover:shadow-[0_0_25px_rgba(215,207,190,0.4)] cursor-pointer'
            }`}
        >
          {!isPicking && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
          )}
          {isPicking ? (
            <>
              <svg className="animate-spin-slow shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#333" strokeWidth="2.5" />
                <path d="M12 3a9 9 0 0 1 9 9" stroke="#666" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span className="uppercase">Picking…</span>
            </>
          ) : (
            <>
              <svg className="relative z-10" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span className="uppercase relative z-10">Pick Color</span>
            </>
          )}
        </button>
      </div>

      {/* Color Preview & Values */}
      {currentColor && (
        <div className="bg-bg-secondary border border-border-subtle rounded-xl p-3.5 space-y-3 animate-slide-up">
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">
            Selected Color
          </p>

          {/* Large Swatch */}
          <div
            className="w-full h-20 rounded-xl border border-border-subtle shadow-inner"
            style={{ backgroundColor: currentColor.hex }}
          />

          {/* Color Formats */}
          <div className="space-y-1.5">
            {formats.map(f => (
              <div
                key={f.label}
                className="flex items-center justify-between bg-bg-base border border-border-subtle rounded-lg px-2.5 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[9px] font-semibold text-text-muted uppercase tracking-widest shrink-0 w-7">
                    {f.label}
                  </span>
                  <span className="text-[11px] font-semibold text-text-primary font-mono truncate">
                    {f.value}
                  </span>
                </div>
                <button
                  onClick={() => copyValue(f.label, f.value)}
                  className="text-[10px] font-semibold text-text-muted hover:text-text-secondary
                    transition-colors duration-200 shrink-0 ml-2 uppercase tracking-wider"
                >
                  {copiedFormat === f.label ? (
                    <span className="text-ok font-bold">Copied!</span>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback Message */}
      {!currentColor && !isPicking && (
        <div className="bg-bg-secondary border border-border-subtle rounded-xl p-4 text-center">
          <p className="text-[11px] text-text-secondary">
            Click <span className="font-semibold text-text-primary">Pick Color</span> to sample any color from the page.
          </p>
          <p className="text-[10px] text-text-muted mt-1">
            Requires EyeDropper API support.
          </p>
        </div>
      )}

      {/* History */}
      {colorHistory.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-1.5">
            Recent Colors
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {colorHistory.map((color, i) => (
              <button
                key={i}
                onClick={() => selectFromHistory(color)}
                className={`aspect-square rounded-lg border transition-all duration-200 hover:scale-110
                  ${color.hex === currentColor?.hex
                    ? 'border-accent shadow-[0_0_8px_rgba(215,207,190,0.3)] ring-1 ring-accent/50'
                    : 'border-border-subtle hover:border-border-default'
                  }`}
                style={{ backgroundColor: color.hex }}
                title={color.hex}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
