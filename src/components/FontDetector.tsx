import { useState, useEffect, useCallback } from 'react';
import { FontInfo } from '../types';
import { ensureContentScriptInjected } from '../utils/contentScript';

export default function FontDetector() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentFont, setCurrentFont] = useState<FontInfo | null>(null);
  const [fontHistory, setFontHistory] = useState<FontInfo[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch initial state and history from background service worker
    chrome.runtime.sendMessage({ type: 'GET_DEVTOOLS_STATE' }, (response) => {
      if (response) {
        if (response.fontHistory) setFontHistory(response.fontHistory);
        if (response.activeFont) setCurrentFont(response.activeFont);
      }
    });

    const handleMessage = (message: { type: string; data?: FontInfo }) => {
      if (message.type === 'FONT_DETECTED' && message.data) {
        setCurrentFont(message.data);
        // Refresh local history list from background state
        chrome.runtime.sendMessage({ type: 'GET_DEVTOOLS_STATE' }, (response) => {
          if (response?.fontHistory) {
            setFontHistory(response.fontHistory);
          }
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const toggleDetection = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const isReady = await ensureContentScriptInjected(tab.id);
    if (!isReady) return;

    if (isDetecting) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'DETECT_FONTS_STOP' });
      } catch (err) {
        console.error('Stop detection error:', err);
      }
      setIsDetecting(false);
    } else {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'DETECT_FONTS_START' });
      } catch (err) {
        console.error('Start detection error:', err);
      }
      setIsDetecting(true);
    }
  }, [isDetecting]);

  const copyFontInfo = useCallback(() => {
    if (!currentFont) return;
    const text = [
      `Font Family: ${currentFont.fontFamily}`,
      `Font Size: ${currentFont.fontSize}`,
      `Font Weight: ${currentFont.fontWeight}`,
      `Line Height: ${currentFont.lineHeight}`,
      `Letter Spacing: ${currentFont.letterSpacing}`,
      `Color: ${currentFont.color}`,
      `Font Style: ${currentFont.fontStyle}`,
      `Text Transform: ${currentFont.textTransform}`,
      `Element: <${currentFont.element}>`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [currentFont]);

  const selectFromHistory = useCallback((font: FontInfo) => {
    setCurrentFont(font);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toggle Button */}
      <div>
        <button
          onClick={toggleDetection}
          className={`w-full h-12 rounded-xl text-[13px] font-bold tracking-wide flex items-center justify-center gap-3
            transition-all duration-300 relative group overflow-hidden
            ${isDetecting
              ? 'bg-[#111] border border-ok/40 text-ok cursor-pointer'
              : 'bg-accent text-[#0a0a0a] border-transparent hover:bg-white active:scale-95 shadow-[0_0_15px_rgba(215,207,190,0.2)] hover:shadow-[0_0_25px_rgba(215,207,190,0.4)] cursor-pointer'
            }`}
        >
          {!isDetecting && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
          )}
          {isDetecting ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ok" />
              </span>
              <span className="uppercase">Detecting…</span>
            </>
          ) : (
            <span className="uppercase relative z-10">Detect Fonts</span>
          )}
        </button>
      </div>

      {/* Current Font Details */}
      {currentFont && (
        <div className="bg-bg-secondary border border-border-subtle rounded-xl p-3.5 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">
              Detected Font
            </p>
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              &lt;{currentFont.element}&gt;
            </span>
          </div>

          {/* Font Preview */}
          <div
            className="bg-bg-base border border-border-subtle rounded-lg p-3 text-center"
            style={{ fontFamily: currentFont.fontFamily }}
          >
            <p className="text-text-primary text-lg leading-relaxed">
              The quick brown fox jumps
            </p>
            <p className="text-[10px] text-text-muted mt-1 font-sans">
              {currentFont.fontFamily}
            </p>
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Family', value: currentFont.fontFamily.split(',')[0].replace(/['"]/g, '').trim() },
              { label: 'Size', value: currentFont.fontSize },
              { label: 'Weight', value: currentFont.fontWeight },
              { label: 'Line Height', value: currentFont.lineHeight },
              { label: 'Spacing', value: currentFont.letterSpacing },
              { label: 'Style', value: currentFont.fontStyle },
              { label: 'Transform', value: currentFont.textTransform },
            ].map(prop => (
              <div key={prop.label} className="bg-bg-base border border-border-subtle rounded-lg px-2.5 py-1.5">
                <p className="text-[9px] font-semibold text-text-muted uppercase tracking-widest">
                  {prop.label}
                </p>
                <p className="text-[11px] font-semibold text-text-primary truncate mt-0.5" title={prop.value}>
                  {prop.value}
                </p>
              </div>
            ))}

            {/* Color with swatch */}
            <div className="bg-bg-base border border-border-subtle rounded-lg px-2.5 py-1.5">
              <p className="text-[9px] font-semibold text-text-muted uppercase tracking-widest">
                Color
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="w-3 h-3 rounded-full border border-border-default shrink-0"
                  style={{ backgroundColor: currentFont.color }}
                />
                <p className="text-[11px] font-semibold text-text-primary truncate font-mono">
                  {currentFont.color}
                </p>
              </div>
            </div>
          </div>

          {/* Copy Button */}
          <button
            onClick={copyFontInfo}
            className="w-full h-9 rounded-xl text-[11px] font-bold uppercase tracking-wide
              bg-bg-tertiary border border-border-subtle text-text-secondary
              hover:text-text-primary hover:border-border-default
              transition-all duration-200 flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Font Info
              </>
            )}
          </button>
        </div>
      )}

      {/* History */}
      {fontHistory.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-1.5">
            Recent Fonts
          </p>
          <div className="space-y-1">
            {fontHistory.map((font, i) => (
              <button
                key={i}
                onClick={() => selectFromHistory(font)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left
                  transition-all duration-200 group
                  ${font === currentFont
                    ? 'bg-bg-tertiary border border-border-default'
                    : 'bg-bg-secondary border border-border-subtle hover:border-border-default hover:bg-bg-tertiary'
                  }`}
              >
                <span
                  className="text-[11px] font-semibold text-text-primary truncate max-w-[60%]"
                  style={{ fontFamily: font.fontFamily }}
                >
                  {font.fontFamily.split(',')[0].replace(/['"]/g, '').trim()}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  {font.fontSize} · {font.fontWeight}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
