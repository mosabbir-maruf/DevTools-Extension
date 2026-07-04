/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import ReactDOM from 'react-dom/client';
import ImageToolkit from '../components/ImageToolkit';
import '../popup/index.css';

function ToolkitApp() {
  return (
    <div className="bg-bg-base text-text-primary flex flex-col font-sans select-none antialiased overflow-x-hidden relative" style={{ minHeight: '100dvh' }}>
      {/* Background glow effects */}
      <div className="absolute top-[-200px] left-1/4 w-[450px] h-[450px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] right-1/4 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center justify-between sm:justify-start gap-8 w-full sm:w-auto">
          <a href="/index.html" className="flex items-center gap-3 select-none group">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight uppercase leading-none text-text-primary group-hover:text-accent transition-colors">DevTools</h1>
          </a>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-[11px] font-mono font-semibold tracking-widest uppercase">
            <a href="/index.html" className="text-text-secondary hover:text-accent transition-colors">Home</a>
            <a href="/index.html#/guide" className="text-text-secondary hover:text-accent transition-colors">Installation Guide</a>
            <a href="/index.html#/faq" className="text-text-secondary hover:text-accent transition-colors">FAQ</a>
            <a href="/index.html#/contact" className="text-text-secondary hover:text-accent transition-colors">Contact</a>
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-text-tertiary shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ok shrink-0 animate-pulse" />
            <span className="text-ok font-semibold text-[9px] tracking-wider">SYS_OPERATIONAL</span>
          </div>
          <a
            href="https://github.com/mosabbir-maruf/FullScreenShot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-1.5 rounded-md border border-border-subtle hover:bg-bg-secondary transition-colors text-text-secondary hover:text-text-primary"
            title="View Source on GitHub"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </a>
        </div>
      </header>

      {/* Workspace Area */}
      <main className="flex-1 flex flex-col relative z-10 min-h-0">
        {/* Page hero */}
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-2 sm:pb-3 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-accent font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">Local Studio</span>
          </div>
          <h2 className="text-[34px] sm:text-[48px] font-semibold tracking-tight leading-[1.05] bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-text-secondary">
            Image Toolkit
          </h2>
          <p className="text-text-secondary text-[15px] sm:text-[16px] max-w-xl mx-auto mt-4 leading-relaxed">
            Convert, compress, resize, crop, and inspect metadata — all processed entirely in your browser. No uploads, no servers.
          </p>
        </div>

        <ImageToolkit />
      </main>

      {/* Footer bar */}
      <footer className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-12 sm:pb-12 border-t border-border-subtle flex flex-col md:flex-row items-center justify-between gap-4 mt-auto text-[9px] sm:text-[10px] text-text-tertiary font-mono relative z-10">
        <div className="order-2 md:order-1 flex flex-col md:flex-row items-center gap-4 md:gap-6">
          <p className="text-center md:text-left">© 2026 DEVTOOLS. ALL RIGHTS RESERVED.</p>
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-widest">VERSION: V2.0</span>
            <div className="w-px h-3 bg-border-subtle" />
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ok shrink-0 animate-pulse" />
              <span className="text-ok font-semibold tracking-wider text-[8px]">SYS_OPERATIONAL</span>
            </div>
          </div>
        </div>

        <div className="order-3 md:order-2 text-center md:text-right">
          DESIGNED & CRAFTED BY{' '}
          <a 
            href="https://github.com/mosabbir-maruf" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
            MOSABBIR MARUF
          </a>
        </div>
      </footer>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ToolkitApp />
    </React.StrictMode>
  );
}
