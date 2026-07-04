import { useState, useCallback } from 'react';

interface ParsedMeta {
  title: string;
  description: string;
  keywords: string;
  author: string;
  canonical: string;
  viewport: string;
  charset: string;
  language: string;
  themeColor: string;
  robots: string;
  og: Record<string, string>;
  twitter: Record<string, string>;
  favicon: string;
  appleTouchIcon: string;
  schemas: string[];
}

function parseHtml(html: string): ParsedMeta {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const getMeta = (name: string): string => {
    const el = doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el?.getAttribute('content') || '';
  };

  const getAllMeta = (prefix: string): Record<string, string> => {
    const result: Record<string, string> = {};
    doc.querySelectorAll(`meta[property^="${prefix}"], meta[name^="${prefix}"]`).forEach(el => {
      const key = el.getAttribute('property') || el.getAttribute('name') || '';
      const value = el.getAttribute('content') || '';
      if (key && value) result[key] = value;
    });
    return result;
  };

  const getLink = (rel: string): string => {
    const el = doc.querySelector(`link[rel="${rel}"]`);
    return el?.getAttribute('href') || '';
  };

  const schemas: string[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
    try {
      const text = el.textContent || '';
      JSON.parse(text);
      schemas.push(text);
    } catch { /* skip invalid JSON-LD */ }
  });

  const lang = doc.documentElement.getAttribute('lang') || '';
  const charset = doc.querySelector('meta[charset]')?.getAttribute('charset') ||
    doc.querySelector('meta[http-equiv="Content-Type"]')?.getAttribute('content')?.split('charset=')[1] || '';

  const og = getAllMeta('og:');
  const twitter = getAllMeta('twitter:');

  return {
    title: doc.title || getMeta('title') || '',
    description: getMeta('description'),
    keywords: getMeta('keywords'),
    author: getMeta('author'),
    canonical: getLink('canonical'),
    viewport: getMeta('viewport'),
    charset,
    language: lang,
    themeColor: getMeta('theme-color') || getMeta('msapplication-TileColor') || '',
    robots: getMeta('robots'),
    og,
    twitter,
    favicon: getLink('icon') || getLink('shortcut icon') || '',
    appleTouchIcon: getLink('apple-touch-icon') || '',
    schemas,
  };
}

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mosabbir Maruf | Portfolio</title>
  <meta name="description" content="Designer & full-stack developer crafting unforgettable digital experiences. Explore projects, skills, and ways to collaborate." />
  <meta name="title" content="Mosabbir Maruf | Portfolio" />
  <link rel="icon" href="https://mosabbirmaruf.vercel.app/images/global/site-icon.svg" type="image/svg+xml" />
  <link rel="canonical" href="https://mosabbirmaruf.vercel.app/" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://mosabbirmaruf.vercel.app/" />
  <meta property="og:title" content="Mosabbir Maruf | Portfolio" />
  <meta property="og:description" content="Designer & full-stack developer crafting unforgettable digital experiences." />
  <meta property="og:image" content="https://mosabbirmaruf.vercel.app/images/social.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Mosabbir Maruf | Portfolio" />
  <meta name="twitter:description" content="Designer & full-stack developer crafting unforgettable digital experiences." />
  <meta name="twitter:image" content="https://mosabbirmaruf.vercel.app/images/social.png" />
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Person","name":"Mosabbir Maruf","url":"https://mosabbirmaruf.vercel.app/","jobTitle":"Designer & Full-Stack Developer","description":"Crafting unforgettable digital experiences."}
  </script>
</head>
<body>
  <p>Portfolio page for Mosabbir Maruf</p>
</body>
</html>`;

function isImageUrl(val: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(val) || val.startsWith('data:image/');
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}
      className="shrink-0 p-1.5 rounded-lg bg-bg-base border border-border-subtle text-text-secondary hover:text-accent-ink hover:border-accent/40 transition-all"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

function MetaRow({ label, value, url }: { label: string; value: string; url?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const showImage = url && isImageUrl(value) && !imgError;

  return (
    <div className="bg-bg-base border border-border-subtle rounded-xl p-3 hover:border-border-default transition-all space-y-2 group">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest font-mono truncate">{label}</span>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyBtn text={value} />
          {url && !showImage && (
            <a href={value} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg bg-bg-base border border-border-subtle text-text-secondary hover:text-accent-ink hover:border-accent/40 transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}
        </div>
      </div>
      {showImage ? (
        <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-bg-base aspect-video">
          <img src={value} alt={label} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        </div>
      ) : (
        <p className="text-[12px] font-medium text-text-primary break-all leading-snug line-clamp-2">{value}</p>
      )}
    </div>
  );
}

function SectionCard({ title, desc, fields, urlFields }: {
  title: string;
  desc?: string;
  fields: { label: string; value: string }[];
  urlFields?: Set<string>;
}) {
  const visible = fields.filter(f => f.value);
  if (visible.length === 0) return null;
  return (
    <section className="bg-bg-secondary border border-border-subtle rounded-2xl p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-text-primary uppercase tracking-widest">{title}</h2>
        {desc && <p className="text-xs text-text-secondary">{desc}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map(f => (
          <MetaRow key={f.label} label={f.label} value={f.value} url={urlFields?.has(f.label)} />
        ))}
      </div>
    </section>
  );
}

function SocialPreview({ og, twitter, siteName }: { og: Record<string, string>; twitter: Record<string, string>; siteName: string }) {
  const title = og['og:title'] || twitter['twitter:title'] || '';
  const desc = og['og:description'] || twitter['twitter:description'] || '';
  const image = og['og:image'] || twitter['twitter:image'] || '';
  const url = og['og:url'] || '';
  const [imgError, setImgError] = useState(false);

  if (!title && !desc) return null;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-text-primary uppercase tracking-widest">Social Preview</h2>
        <p className="text-sm text-text-secondary">How your page looks when shared on social platforms.</p>
      </div>
      <div className="bg-bg-base border border-border-subtle rounded-2xl overflow-hidden shadow-lg">
        {image && !imgError ? (
          <div className="bg-bg-tertiary relative overflow-hidden max-h-48">
            <img src={image} alt="Social preview" className="w-full h-48 object-cover" onError={() => setImgError(true)} />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-br from-bg-tertiary to-bg-secondary flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
        <div className="p-4 space-y-1.5">
          <span className="text-[10px] font-bold text-accent-ink uppercase tracking-wider font-mono">{siteName || og['og:site_name'] || 'Social Card'}</span>
          <h3 className="text-base font-semibold text-text-primary leading-snug">{title}</h3>
          {desc && <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">{desc}</p>}
          {url && <span className="text-[11px] text-text-muted font-mono block truncate">{url}</span>}
        </div>
      </div>
    </section>
  );
}

function SchemaBlock({ schemas }: { schemas: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copiedSchema, setCopiedSchema] = useState(false);
  if (schemas.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-text-primary uppercase tracking-widest">Structured Data</h2>
        <p className="text-sm text-text-secondary">{schemas.length} JSON-LD schema{schemas.length !== 1 ? 's' : ''} detected</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {schemas.map((s, i) => {
          let type = 'Schema';
          try { const p = JSON.parse(s); type = p['@type'] || p['@context'] || `#${i+1}`; } catch { /* keep default label */ }
          return (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono transition-all ${
                activeIdx === i
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default'
              }`}
            >
              {typeof type === 'string' ? type : `#${i+1}`}
            </button>
          );
        })}
      </div>
      <div className="bg-bg-base border border-border-subtle rounded-2xl overflow-hidden">
        <pre className="p-4 sm:p-5 text-[12px] font-mono text-accent-ink/80 leading-relaxed overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">{schemas[activeIdx]}</pre>
        <div className="border-t border-border-subtle px-4 py-3 flex justify-end gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(schemas[activeIdx]).then(() => { setCopiedSchema(true); setTimeout(() => setCopiedSchema(false), 1500); })}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-bg-secondary border border-border-subtle hover:border-accent/30 transition-all flex items-center gap-1.5"
          >
            {copiedSchema ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>Copied!</>
            ) : (
              'Copy'
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function MetaPage() {
  const [html, setHtml] = useState('');
  const [parsed, setParsed] = useState<ParsedMeta | null>(null);
  const [activeSection, setActiveSection] = useState('all');
  const [copiedAll, setCopiedAll] = useState(false);

  const handleParse = useCallback(() => {
    if (!html.trim()) return;
    const result = parseHtml(html);
    setParsed(result);
    setActiveSection('all');
  }, [html]);

  const loadSample = useCallback(() => {
    setHtml(SAMPLE_HTML);
    setParsed(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleParse();
  }, [handleParse]);

  const copyAll = useCallback(() => {
    if (!parsed) return;
    const payload = {
      title: parsed.title,
      description: parsed.description,
      canonical: parsed.canonical,
      og: parsed.og,
      twitter: parsed.twitter,
      schemas: parsed.schemas,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }, [parsed]);

  const sections = [
    {
      id: 'standard',
      label: 'Standard',
      fields: [
        { label: 'title', value: parsed?.title || '' },
        { label: 'description', value: parsed?.description || '' },
        { label: 'keywords', value: parsed?.keywords || '' },
        { label: 'canonical', value: parsed?.canonical || '' },
        { label: 'viewport', value: parsed?.viewport || '' },
        { label: 'charset', value: parsed?.charset || '' },
        { label: 'language', value: parsed?.language || '' },
        { label: 'robots', value: parsed?.robots || '' },
        { label: 'theme-color', value: parsed?.themeColor || '' },
        { label: 'author', value: parsed?.author || '' },
      ],
    },
    {
      id: 'social',
      label: 'Social',
      fields: [
        ...(parsed?.og ? Object.entries(parsed.og).map(([k, v]) => ({ label: k, value: v })) : []),
        ...(parsed?.twitter ? Object.entries(parsed.twitter).map(([k, v]) => ({ label: k, value: v })) : []),
      ],
    },
  ];

  const urlFieldSet = new Set([
    'canonical', 'og:url', 'og:image', 'twitter:image',
    'og:image:secure_url', 'og:video', 'og:audio',
    'favicon', 'apple-touch-icon', 'appleTouchIcon',
  ]);

  const siteName = parsed?.og?.['og:site_name'] || '';

  return (
    <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-12 sm:py-20 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-16">

        {/* ── Hero Header ───────────────────────────────── */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-accent-ink font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">Toolkit</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-[36px] sm:text-[52px] font-semibold tracking-tight leading-[1.05] text-text-primary">
              Meta Inspector
            </h1>
            <p className="text-text-secondary text-[16px] max-w-2xl mx-auto leading-relaxed">
              Paste any HTML source to instantly extract and inspect titles, Open Graph tags, Twitter Cards, favicons, and JSON-LD structured data.
            </p>
          </div>
        </div>

        {/* ── Input Section ──────────────────────────────── */}
        <div className="bg-gradient-to-br from-bg-secondary to-bg-base border border-border-subtle rounded-3xl p-5 sm:p-7 space-y-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 blur-[80px] rounded-full pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-ink">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-widest">HTML Source</h2>
                <p className="text-[10px] font-mono text-text-muted">Ctrl+Enter to parse</p>
              </div>
            </div>
            <button
              onClick={loadSample}
              className="px-4 py-2 rounded-xl bg-bg-base border border-border-subtle text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-accent-ink hover:border-accent/30 transition-all"
            >
              Load Sample
            </button>
          </div>

          <textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste the HTML source of any webpage here..."
            rows={14}
            className="w-full bg-bg-base border border-border-subtle rounded-xl p-4 text-[13px] font-mono text-text-primary placeholder:text-text-muted resize-y focus:outline-none focus:border-accent/40 transition-colors relative z-10 leading-relaxed min-h-[320px]"
          />

          <button
            onClick={handleParse}
            disabled={!html.trim()}
            className="w-full py-3.5 rounded-xl bg-accent text-on-accent font-bold text-xs uppercase tracking-wider hover:bg-accent-dim disabled:opacity-25 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(215,207,190,0.15)] hover:shadow-[0_0_30px_rgba(215,207,190,0.25)] active:scale-[0.99] relative z-10"
          >
            Extract Metadata
          </button>

          <div className="flex items-center justify-center gap-4 text-[9px] font-mono text-text-muted relative z-10 select-none">
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              100% client-side
            </span>
            <span className="w-px h-3 bg-border-subtle" />
            <span>No server uploads</span>
            <span className="w-px h-3 bg-border-subtle" />
            <span>Open source</span>
          </div>
        </div>

        {/* ── Results ────────────────────────────────────── */}
        {parsed && (
          <div className="space-y-10 animate-fade-in">

            {/* Summary Bar */}
            <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-4 sm:p-5 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mr-1">Summary</span>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${parsed.title ? 'bg-ok/10 text-ok border border-ok/20' : 'bg-err/10 text-err border border-err/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${parsed.title ? 'bg-ok' : 'bg-err'}`} />
                {parsed.title ? 'Title OK' : 'No Title'}
              </span>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${parsed.description ? 'bg-ok/10 text-ok border border-ok/20' : 'bg-accent/10 text-accent-ink border border-accent/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${parsed.description ? 'bg-ok' : 'bg-accent'}`} />
                {parsed.description ? `Desc ${parsed.description.length}c` : 'No Desc'}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent-ink border border-accent/20 text-[10px] font-bold uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {Object.keys(parsed.og).length} OG
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent-ink border border-accent/20 text-[10px] font-bold uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {Object.keys(parsed.twitter).length} Twitter
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent-ink border border-accent/20 text-[10px] font-bold uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {parsed.schemas.length} Schema{parsed.schemas.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Section Tabs + Copy Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'standard', label: 'Standard' },
                  { id: 'social', label: 'Social' },
                  { id: 'schemas', label: 'Schemas' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                      activeSection === s.id
                        ? 'bg-accent text-on-accent shadow-sm'
                        : 'bg-bg-base border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={copyAll}
                className="px-4 py-2 rounded-xl bg-accent text-on-accent font-bold text-[10px] uppercase tracking-wider hover:bg-accent-dim transition-all shadow-[0_0_12px_rgba(215,207,190,0.15)] active:scale-[0.98] flex items-center gap-2 shrink-0"
              >
                {copiedAll ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Copy JSON
                  </>
                )}
              </button>
            </div>

            {/* Results Dashboard */}
            {activeSection === 'all' ? (
              <div className="space-y-6">
                <SectionCard
                  title="Standard Metadata"
                  desc="Basic page-level tags for SEO and browser rendering."
                  fields={sections[0].fields}
                  urlFields={urlFieldSet}
                />
                {(parsed.favicon || parsed.appleTouchIcon) && (
                  <section className="bg-bg-secondary border border-border-subtle rounded-2xl p-5 space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-text-primary uppercase tracking-widest">Icons</h2>
                      <p className="text-xs text-text-secondary">Favicon and touch icons for browsers and devices.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {parsed.favicon && <MetaRow label="favicon" value={parsed.favicon} url />}
                      {parsed.appleTouchIcon && <MetaRow label="apple-touch-icon" value={parsed.appleTouchIcon} url />}
                    </div>
                  </section>
                )}
                {parsed.og && Object.keys(parsed.og).length > 0 && (
                  <SocialPreview og={parsed.og} twitter={parsed.twitter} siteName={siteName} />
                )}
                <SectionCard
                  title="Social Tags"
                  desc="Open Graph and Twitter Card tags for social sharing."
                  fields={sections[1].fields}
                  urlFields={urlFieldSet}
                />
              </div>
            ) : (
              <div className="space-y-6">
                {activeSection === 'standard' && (
                  <>
                    <SectionCard
                      title="Standard Metadata"
                      desc="Basic page-level tags for SEO and browser rendering."
                      fields={sections[0].fields}
                      urlFields={urlFieldSet}
                    />
                    {(parsed.favicon || parsed.appleTouchIcon) && (
                      <section className="bg-bg-secondary border border-border-subtle rounded-2xl p-5 space-y-4">
                        <div className="space-y-1">
                          <h2 className="text-base font-bold text-text-primary uppercase tracking-widest">Icons</h2>
                          <p className="text-xs text-text-secondary">Favicon and touch icons for browsers and devices.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {parsed.favicon && <MetaRow label="favicon" value={parsed.favicon} url />}
                          {parsed.appleTouchIcon && <MetaRow label="apple-touch-icon" value={parsed.appleTouchIcon} url />}
                        </div>
                      </section>
                    )}
                  </>
                )}
                {activeSection === 'social' && (
                  <>
                    {parsed.og && Object.keys(parsed.og).length > 0 && (
                      <SocialPreview og={parsed.og} twitter={parsed.twitter} siteName={siteName} />
                    )}
                    <SectionCard
                      title="Social Tags"
                      desc="Open Graph and Twitter Card tags for social sharing."
                      fields={sections[1].fields}
                      urlFields={urlFieldSet}
                    />
                  </>
                )}
                {activeSection === 'schemas' && parsed.schemas.length > 0 && (
                  <div className="max-w-2xl">
                    <SchemaBlock schemas={parsed.schemas} />
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}
