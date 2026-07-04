import { useState, useEffect, useRef } from 'react';

type Mode = 'fullpage' | 'visible' | 'selected' | 'font' | 'color' | 'meta';

// Points the eyedropper loupe travels between while "picking" colors.
// x is a percentage across the viewport, y is pixels from the top (viewport is 256px tall).
const COLOR_STOPS = [
  { color: '#D7CFBE', x: 30, y: 44 },
  { color: '#3d9970', x: 64, y: 128 },
  { color: '#cc4444', x: 42, y: 196 },
  { color: '#4c6ef5', x: 20, y: 96 },
  { color: '#e8a33d', x: 74, y: 150 },
];

export default function Home() {
  const [activeMode, setActiveMode] = useState<Mode>('fullpage');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [simulatedFont, setSimulatedFont] = useState<{ family: string; size: string; weight: string; color: string; tag: string } | null>(null);
  const [simulatedColor, setSimulatedColor] = useState<string | null>(null);
  const [pickIdx, setPickIdx] = useState(0);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Scroll animation for Full Page simulation
  useEffect(() => {
    if (activeMode !== 'fullpage') {
      setScrollOffset(0);
      return;
    }
    const interval = setInterval(() => {
      setScrollOffset((prev) => {
        if (prev >= 180) {
          setIsCapturing(true);
          captureTimerRef.current = setTimeout(() => setIsCapturing(false), 800);
          return 0; // reset
        }
        return prev + 1.5;
      });
    }, 30);
    return () => {
      clearInterval(interval);
      clearTimeout(captureTimerRef.current);
    };
  }, [activeMode]);

  // Selection box simulation
  useEffect(() => {
    if (activeMode !== 'selected') {
      setSelectionBox(null);
      return;
    }
    const interval = setInterval(() => {
      setSelectionBox((prev) => {
        if (!prev) return { x: 40, y: 50, w: 0, h: 0 };
        if (prev.w >= 220) {
          setIsCapturing(true);
          captureTimerRef.current = setTimeout(() => setIsCapturing(false), 800);
          return null; // reset
        }
        return { x: 40, y: 50, w: prev.w + 4, h: prev.h + 2.5 };
      });
    }, 40);
    return () => {
      clearInterval(interval);
      clearTimeout(captureTimerRef.current);
    };
  }, [activeMode]);

  // Capture effect for Visible simulation
  useEffect(() => {
    if (activeMode !== 'visible') return;
    const interval = setInterval(() => {
      setIsCapturing(true);
      captureTimerRef.current = setTimeout(() => setIsCapturing(false), 600);
    }, 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(captureTimerRef.current);
    };
  }, [activeMode]);

  // Font detector simulation
  useEffect(() => {
    if (activeMode !== 'font') {
      setSimulatedFont(null);
      return;
    }
    const fontsList = [
      { family: 'Geist Sans', size: '24px', weight: '600', color: '#f2f2f2', tag: 'h2' },
      { family: 'Geist Mono', size: '12px', weight: '400', color: '#D7CFBE', tag: 'span' },
      { family: 'system-ui', size: '14px', weight: '400', color: '#888888', tag: 'p' },
    ];
    let idx = 0;
    setSimulatedFont(fontsList[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % fontsList.length;
      setSimulatedFont(fontsList[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [activeMode]);

  // Color picker simulation
  useEffect(() => {
    if (activeMode !== 'color') {
      setSimulatedColor(null);
      return;
    }
    let idx = 0;
    setSimulatedColor(COLOR_STOPS[0].color);
    setPickIdx(0);
    const interval = setInterval(() => {
      idx = (idx + 1) % COLOR_STOPS.length;
      setSimulatedColor(COLOR_STOPS[idx].color);
      setPickIdx(idx);
    }, 1500);
    return () => clearInterval(interval);
  }, [activeMode]);

  return (
    <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-24 sm:space-y-32 animate-fade-in">
      {/* 1. Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
        <div className="lg:col-span-6 space-y-8">
          {/* Text Content */}
          <div className="flex flex-col justify-center items-start z-10 max-w-xl relative">
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-accent/10 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/5 border border-accent/10 mb-6 backdrop-blur-md relative z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-accent-ink font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">Extension V2.0</span>
            </div>

            <h2 className="text-[36px] sm:text-[48px] lg:text-[64px] font-semibold tracking-tight leading-[1.05] mb-6 max-w-[540px] bg-clip-text text-transparent bg-gradient-to-b from-text-primary via-text-primary to-text-secondary relative z-10">
              Developer toolkit for web precision.
            </h2>
            
            <p className="text-[17px] text-text-secondary mb-10 leading-[1.6] max-w-[500px] relative z-10">
              DevTools is an all-in-one local helper. Capture full-page layouts, inspect font properties on-hover, and pick color codes instantly from any tab with absolute privacy.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto relative z-10">
              <button 
                onClick={() => window.open('https://github.com/mosabbir-maruf/FullScreenShot', '_blank')}
                className="px-8 py-3.5 bg-accent text-on-accent rounded-full font-semibold hover:bg-accent-dim hover:scale-[1.02] active:scale-95 transition-all duration-200 text-[15px] shadow-[0_0_20px_rgba(215,207,190,0.2)]"
              >
                Install From GitHub
              </button>
              <button 
                onClick={() => window.location.pathname = '/guide'}
                className="px-8 py-3.5 bg-bg-primary/80 backdrop-blur-md text-text-primary rounded-full font-medium hover:bg-bg-secondary hover:scale-[1.02] active:scale-95 transition-all duration-200 text-[15px] border border-border-default"
              >
                Installation Guide
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Interactive Browser Engine Mockup */}
        <div className="lg:col-span-6 space-y-4 sm:space-y-6 mt-8 lg:mt-0">
          <div className="space-y-2.5">
            <span className="block text-[9px] sm:text-[10px] font-semibold text-text-tertiary uppercase tracking-widest font-mono text-center sm:text-left">
              Interactive Engine Mockup
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {([
                ['fullpage', 'Full Page'],
                ['visible', 'Visible'],
                ['selected', 'Region'],
                ['font', 'Font'],
                ['color', 'Color'],
                ['meta', 'Meta'],
              ] as [Mode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setActiveMode(m)}
                  className={`text-[11px] tracking-tight transition-colors duration-200 ${
                    activeMode === m
                      ? 'text-text-primary font-medium'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Browser Container Frame */}
          <div className="w-full bg-bg-secondary border border-border-default rounded-xl overflow-hidden shadow-2xl relative">
            {/* Browser chrome header bar */}
            <div className="px-4 py-3 bg-bg-tertiary border-b border-border-subtle flex items-center gap-3">
              <div className="flex gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ffbd2e' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#28c840' }} />
              </div>
              <div className="flex-1 bg-bg-base border border-border-subtle rounded-md h-5 px-2 flex items-center gap-1.5 text-[9px] text-text-tertiary font-mono">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span className="truncate">devtools-ext.vercel.app</span>
              </div>
            </div>

            {/* Virtual Webpage Viewport */}
            <div className="h-64 overflow-hidden relative bg-bg-base">
              {isCapturing && (
                <div className="absolute inset-0 bg-accent-ink/15 backdrop-blur-[1px] z-50 flex items-center justify-center animate-fade-in">
                  <div className="bg-bg-secondary/95 border border-accent-ink/30 px-3.5 py-2 rounded-lg flex items-center gap-2 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-ok animate-ping" />
                    <span className="text-[10px] font-mono font-bold tracking-wider text-accent-ink uppercase">Viewport Captured</span>
                  </div>
                </div>
              )}
              
              <div 
                className="p-5 space-y-4 transition-transform duration-100 ease-out"
                style={{ transform: `translateY(-${scrollOffset}px)` }}
              >
                <div className="space-y-1 relative">
                  <span className="text-[8px] font-bold text-accent-ink font-mono">01 / BRAND SYSTEM</span>
                  <div className={`h-4 bg-text-primary/[0.22] w-2/3 rounded-sm transition-all duration-300 ${activeMode === 'font' && simulatedFont?.tag === 'h2' ? 'ring-2 ring-accent-ink bg-accent-ink/20' : ''}`} />
                  <div className="h-2.5 bg-text-primary/[0.1] w-5/6 rounded-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="h-20 bg-bg-secondary rounded-lg border border-border-subtle flex flex-col justify-end p-2 gap-1 relative">
                    <div className="h-2 bg-text-primary/[0.22] w-3/4 rounded-sm" />
                    <div className="h-1.5 bg-text-primary/[0.1] w-1/2 rounded-sm" />
                  </div>
                  <div className="h-20 bg-bg-secondary rounded-lg border border-border-subtle flex flex-col justify-end p-2 gap-1 relative">
                    <div className="h-2 bg-text-primary/[0.22] w-2/3 rounded-sm" />
                    <div className="h-1.5 bg-text-primary/[0.1] w-1/3 rounded-sm" />
                  </div>
                </div>
                <div className="space-y-1.5 pt-2 relative">
                  <span className="text-[8px] font-bold text-accent-ink font-mono">02 / INTERACTION</span>
                  <div className="h-3.5 bg-text-primary/[0.22] w-1/2 rounded-sm" />
                  <div className="h-2.5 bg-text-primary/[0.1] w-full rounded-sm" />
                  <div className="h-2.5 bg-text-primary/[0.1] w-4/5 rounded-sm" />
                </div>
              </div>

              {activeMode === 'fullpage' && (
                <div className="absolute left-0 right-0 z-20 flex items-center gap-2 transition-[top] duration-[100ms] ease-out" style={{ top: `${30 + scrollOffset * 1.1}px` }}>
                  <span className="bg-accent text-on-accent text-[8px] font-mono px-1.5 py-0.5 rounded tracking-widest font-bold leading-none shrink-0">SCANNING</span>
                  <div className="flex-1 h-0.5 bg-accent-ink/70 shadow-[0_0_8px_rgba(215,207,190,0.6)]" />
                </div>
              )}

              {activeMode === 'selected' && selectionBox && (
                <div 
                  className="absolute border border-dashed border-accent-ink bg-accent-ink/10 pointer-events-none z-30"
                  style={{
                    left: `${selectionBox.x}px`,
                    top: `${selectionBox.y}px`,
                    width: `${selectionBox.w}px`,
                    height: `${selectionBox.h}px`,
                  }}
                >
                  <div className="absolute right-0 bottom-0 bg-accent-ink text-bg-base text-[7px] font-mono px-1 rounded-tl-sm font-semibold">
                    {Math.round(selectionBox.w)} × {Math.round(selectionBox.h)}
                  </div>
                  <div className="absolute -right-1 -bottom-1 w-2.5 h-2.5 rounded-full bg-accent-ink border border-bg-base" />
                </div>
              )}

              {activeMode === 'font' && simulatedFont && (
                <div className="absolute bottom-4 left-4 right-4 bg-bg-secondary/95 border border-border-default p-3 rounded-lg shadow-xl animate-slide-up z-40 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8px] font-bold text-accent-ink font-mono uppercase tracking-wider">Inspect Element: {simulatedFont.tag}</span>
                    <span className="text-[8px] font-mono text-text-secondary">{simulatedFont.size} // {simulatedFont.weight}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-text-primary leading-none" style={{ fontFamily: simulatedFont.family }}>
                    Font Family: {simulatedFont.family}
                  </p>
                  <p className="text-[9px] text-text-tertiary font-mono mt-1">
                    Color: {simulatedFont.color}
                  </p>
                </div>
              )}

              {activeMode === 'color' && simulatedColor && (
                <div
                  className="absolute z-40 transition-all duration-700 ease-in-out"
                  style={{
                    left: `${COLOR_STOPS[pickIdx].x}%`,
                    top: `${COLOR_STOPS[pickIdx].y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Eyedropper loupe */}
                  <div className="relative">
                    <div
                      className="w-11 h-11 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.45)] ring-2 ring-white/90"
                      style={{ backgroundColor: simulatedColor }}
                    />
                    {/* Crosshair */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-px bg-white/70 absolute" />
                      <div className="h-4 w-px bg-white/70 absolute" />
                      <div className="w-2 h-2 rounded-full border border-white/90" />
                    </div>
                    {/* Hex readout */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap bg-bg-secondary/95 border border-border-default px-2 py-1 rounded-md shadow-lg backdrop-blur-md flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full border border-border-subtle shrink-0"
                        style={{ backgroundColor: simulatedColor }}
                      />
                      <span className="font-mono text-[9px] font-bold text-text-primary uppercase tracking-wider">
                        {simulatedColor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeMode === 'meta' && (
                <div className="absolute inset-0 bg-bg-base/30 z-40 flex items-center justify-center animate-fade-in p-4">
                  <div className="bg-bg-secondary/95 border border-border-default p-4 rounded-xl shadow-xl w-full max-w-[280px] space-y-2.5 backdrop-blur-md text-left">
                    <div className="flex items-center justify-between text-[8px] font-mono font-bold text-accent-ink uppercase tracking-wider">
                      <span>Meta Inspector Preview</span>
                      <span className="text-ok">SEO OK</span>
                    </div>
                    <div className="bg-bg-base border border-border-subtle rounded p-2.5 space-y-2 font-mono text-[9px]">
                      <div className="flex justify-between text-text-secondary">
                        <span>Title:</span>
                        <span className="text-text-primary font-semibold truncate max-w-[120px]">DevTools Extension</span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Description:</span>
                        <span className="text-text-primary font-semibold truncate max-w-[120px]">Unified developer tools local suite</span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Open Graph:</span>
                        <span className="text-ok font-semibold">VALID og:image</span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Schemas:</span>
                        <span className="text-accent-ink font-semibold">2 JSON-LD</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 bg-bg-secondary border border-border-subtle rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-mono">Engine Status</span>
              <p className="text-xs text-text-secondary leading-tight">Mock scanning tab coordinates: active</p>
            </div>
            <span className="text-xs font-mono font-bold text-accent-ink">OK // SECURE</span>
          </div>
        </div>
      </section>

      {/* 2. Features Section */}
      <section className="space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-accent-ink font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">Capabilities</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-light tracking-tight text-text-primary">Engineered for quality</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Four integrated utilities, one lightweight extension. Everything is processed locally with zero servers, telemetry, or tracking.
            </p>
          </div>
          <span className="hidden sm:block text-[10px] font-mono uppercase tracking-widest text-text-tertiary shrink-0">04 Utilities</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">

          {/* Featured — Local processing */}
          <div className="md:col-span-3 lg:col-span-2 lg:row-span-2 group relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-secondary p-7 sm:p-8 flex flex-col justify-between min-h-[220px] hover:border-accent/40 transition-colors">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-accent/10 blur-[90px] rounded-full pointer-events-none" />
            <div className="relative z-10 flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent-ink">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <span className="font-mono text-[11px] font-bold text-accent-ink tracking-widest">01</span>
            </div>
            <div className="relative z-10 mt-8 space-y-3">
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-text-tertiary">Privacy first</span>
              <h4 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">100% local processing</h4>
              <p className="text-sm text-text-secondary leading-relaxed max-w-md">
                Every capture, inspection, and conversion runs on your device. Nothing is ever uploaded — secure by design, even for sensitive pages.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {['No servers', 'No telemetry', 'Works offline'].map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-bg-base border border-border-subtle text-[10px] font-mono text-text-secondary">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Standard feature cards — the four core utilities */}
          {[
            {
              n: '02',
              title: 'Full page & region capture',
              desc: 'Stitch full-page scrolls, grab the viewport, or select a region. Export PNG, JPEG, WebP, PDF, or SVG.',
              icon: (
                <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 15l4-4 4 4 3-3 4 4" /><circle cx="8" cy="9" r="1.4" /></>
              ),
            },
            {
              n: '03',
              title: 'Font inspector',
              desc: 'Hover any element to read size, weight, letter-spacing, line-height, style, and font family.',
              icon: (
                <><path d="M4 7V5h16v2" /><path d="M12 5v14" /><path d="M9 19h6" /></>
              ),
            },
            {
              n: '04',
              title: 'Eyedropper color picker',
              desc: 'Pick any screen color with the native EyeDropper API and copy HEX, RGB, or HSL instantly.',
              icon: (
                <><path d="M19 3a2.83 2.83 0 0 0-4 0l-2 2-1-1-2 2 6 6 2-2-1-1 2-2a2.83 2.83 0 0 0 0-4z" /><path d="M11 8l-7 7v4h4l7-7" /></>
              ),
            },
            {
              n: '05',
              title: 'SEO meta inspector',
              desc: 'Audit headers, Open Graph, Twitter cards, hreflang alternates, and JSON-LD schemas locally.',
              icon: (
                <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>
              ),
            },
          ].map((f) => (
            <div key={f.n} className="group relative rounded-2xl border border-border-subtle bg-bg-secondary p-5 sm:p-6 space-y-4 hover:border-border-default hover:bg-bg-tertiary/40 transition-all">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center text-accent-ink group-hover:scale-105 transition-transform">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </div>
                <span className="font-mono text-[10px] font-bold text-text-tertiary tracking-widest group-hover:text-accent-ink transition-colors">{f.n}</span>
              </div>
              <div>
                <h4 className="text-[15px] font-semibold text-text-primary mb-1.5 tracking-tight">{f.title}</h4>
                <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. How it works Section */}
      <section className="space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-accent-ink font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">Workflow</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-light tracking-tight text-text-primary">How it works</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              From install to export in three simple steps — no accounts, no setup, no learning curve.
            </p>
          </div>
          <span className="hidden sm:block text-[10px] font-mono uppercase tracking-widest text-text-tertiary shrink-0">03 Steps</span>
        </div>

        <div className="relative">
          {/* Horizontal connecting rail (desktop) */}
          <div className="hidden md:block absolute left-0 right-0 top-[46px] h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                n: '01',
                label: 'Install',
                title: 'Pin the extension',
                desc: 'Click the puzzle icon in Chrome and pin DevTools for one-click access on any page.',
                icon: (
                  <><path d="M12 2v6" /><path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z" /><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M9 14h.01M15 14h.01" /></>
                ),
              },
              {
                n: '02',
                label: 'Activate',
                title: 'Trigger a tool',
                desc: 'Open the popup, pick Screenshot, Fonts, Colors, or Meta, and launch the tool instantly.',
                icon: (
                  <><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></>
                ),
              },
              {
                n: '03',
                label: 'Export',
                title: 'Preview & copy',
                desc: 'Inspect styles, copy color values, or export captures to PNG, JPEG, WebP, PDF, or SVG.',
                icon: (
                  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>
                ),
              },
            ].map((s) => (
              <div
                key={s.n}
                className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-secondary p-6 sm:p-7 transition-all duration-300 hover:border-accent/40 hover:-translate-y-1 hover:shadow-panel"
              >
                {/* Oversized ghost number */}
                <span className="pointer-events-none absolute -top-4 -right-1 font-mono font-bold text-[88px] leading-none text-text-primary/[0.04] group-hover:text-accent/10 transition-colors select-none">
                  {s.n}
                </span>
                {/* Hover glow */}
                <div className="pointer-events-none absolute -bottom-16 -left-10 w-40 h-40 bg-accent/10 blur-[70px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10 space-y-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-bg-base border border-border-default flex items-center justify-center text-accent-ink shadow-sm group-hover:border-accent group-hover:bg-accent/10 group-hover:scale-105 transition-all duration-300">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {s.icon}
                    </svg>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[11px] font-bold text-accent-ink">{s.n}</span>
                      <span className="w-1 h-1 rounded-full bg-text-muted" />
                      <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-text-tertiary">{s.label}</span>
                    </div>
                    <h4 className="text-lg font-semibold text-text-primary tracking-tight">{s.title}</h4>
                    <p className="text-[13px] text-text-secondary leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Maker — Open Source panel */}
      <section className="space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-accent-ink font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">Open Source</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-light tracking-tight text-text-primary">Built in the open</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              A free, MIT-licensed project maintained by one developer — with community contributions welcome.
            </p>
          </div>
          <span className="hidden sm:block text-[10px] font-mono uppercase tracking-widest text-text-tertiary shrink-0">The Maker</span>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-bg-secondary">
          {/* ambient glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-accent/10 blur-[120px] rounded-full pointer-events-none" />
          {/* corner ticks */}
          <span className="absolute top-4 left-4 w-2 h-2 border-t border-l border-border-default" />
          <span className="absolute top-4 right-4 w-2 h-2 border-t border-r border-border-default" />
          <span className="absolute bottom-4 left-4 w-2 h-2 border-b border-l border-border-default" />
          <span className="absolute bottom-4 right-4 w-2 h-2 border-b border-r border-border-default" />

          <div className="relative z-10 p-8 sm:p-12 lg:p-14">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">

              {/* Maker identity */}
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <img
                    src="/mosabbir-maruf.webp"
                    alt="Mosabbir Maruf"
                    loading="lazy"
                    className="w-16 h-16 rounded-2xl object-cover border border-border-default"
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-bg-secondary flex items-center justify-center" title="Verified">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-label="Verified">
                      <path fill="#1d9bf0" d="M12 2.5l2.36 1.7 2.9-.02 1.68 2.36 2.86.65-.02 2.9.65 2.86-2.36 1.68-.02 2.9-2.9-.02L14.36 22 12 20.3 9.64 22l-1.68-2.36-2.9.02-.02-2.9-2.36-1.68.65-2.86-.02-2.9 2.86-.65L7.28 4.18l2.9.02z"/>
                      <path fill="#fff" d="M10.6 14.6l-2.2-2.2-1.2 1.2 3.4 3.4 6-6-1.2-1.2z"/>
                    </svg>
                  </span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-text-tertiary uppercase tracking-[0.2em]">Designed &amp; built by</span>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary leading-none">Mosabbir Maruf</h2>
                  <a
                    href="https://github.com/mosabbir-maruf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-mono text-text-secondary hover:text-accent-ink transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    @mosabbir-maruf
                  </a>
                </div>
              </div>

              {/* divider */}
              <div className="hidden lg:block w-px self-stretch bg-border-subtle" />

              {/* Closing note + actions */}
              <div className="lg:max-w-sm space-y-5">
                <p className="text-[14px] text-text-secondary leading-relaxed">
                  DevTools is an open-source project, free forever. Contributions, bug reports, and feature
                  ideas are always welcome.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="https://github.com/mosabbir-maruf/FullScreenShot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 bg-accent text-on-accent rounded-full font-semibold hover:bg-accent-dim hover:scale-[1.02] active:scale-95 transition-all duration-200 text-[13px]"
                  >
                    Install From GitHub
                  </a>
                  <a
                    href="/guide"
                    className="inline-flex items-center justify-center px-6 py-3 bg-bg-base text-text-primary rounded-full font-medium hover:bg-bg-tertiary hover:scale-[1.02] active:scale-95 transition-all duration-200 text-[13px] border border-border-default"
                  >
                    Read the Guide
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* 5. Bottom CTA Section */}
      <section className="bg-bg-secondary border border-border-subtle rounded-3xl p-10 sm:p-16 text-center space-y-8 shadow-panel relative overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-text-primary">Ready to upgrade your workflow?</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Add DevTools to Chrome today and experience precision designing. No signup required.
          </p>
        </div>
        <div className="relative z-10">
          <a href="https://github.com/mosabbir-maruf/FullScreenShot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-8 py-3.5 bg-accent text-on-accent rounded-full font-semibold hover:bg-accent-dim hover:scale-[1.02] active:scale-95 transition-all duration-200 text-[15px] shadow-[0_0_20px_rgba(215,207,190,0.2)]">
            Install From GitHub
          </a>
        </div>
      </section>

    </main>
  );
}
