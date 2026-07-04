import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { MetadataPayload } from '../types';
import { ensureContentScriptInjected } from '../utils/contentScript';

interface ValidationWarning {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); })}
      className="shrink-0 p-1.5 rounded-md bg-bg-secondary border border-border-subtle text-text-tertiary hover:text-accent hover:border-accent/40 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
      title={`Copy ${label}`}
    >
      {copied ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function MetaField({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="bg-bg-secondary/60 border border-border-subtle rounded-lg px-3 py-2 flex items-center justify-between gap-2 group hover:border-border-default transition-colors">
      <div className="min-w-0 flex-1">
        <span className="block text-[8px] font-bold text-text-tertiary uppercase tracking-[0.12em]">
          {label}
        </span>
        <p className={`text-[10.5px] font-medium truncate mt-0.5 leading-tight ${value ? 'text-text-primary' : 'text-text-muted font-normal italic'}`} title={value || 'Not defined'}>
          {value || 'Not defined'}
        </p>
      </div>
      {value && <CopyButton text={value} label={label} />}
    </div>
  );
}

// Small labelled divider used to head each content section.
function SectionLabel({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <span className={`block text-[8px] font-bold uppercase tracking-[0.15em] ${accent ? 'text-accent' : 'text-text-tertiary'}`}>
        {children}
      </span>
      <span className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

const TABS = ['overview', 'standard', 'social', 'seo', 'schemas'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Audit',
  standard: 'Basic',
  social: 'Social',
  seo: 'SEO',
  schemas: 'Schema',
};

export default function MetaInspector() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetadataPayload | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeSchemaIdx, setActiveSchemaIdx] = useState<number>(0);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  const fetchMetadata = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      const isRestricted = !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:');

      if (isRestricted) throw new Error('Cannot inspect browser system pages or settings.');

      const isReady = await ensureContentScriptInjected(tab.id);
      if (!isReady) throw new Error('Content script injection failed.');

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_METADATA' });
      if (response?.error) throw new Error(response.error);
      if (response?.data) {
        const payload: MetadataPayload = response.data;
        setData(payload);

        const list: ValidationWarning[] = [];

        if (!payload.standard.title) {
          list.push({ field: 'Title', message: 'Page title is missing.', type: 'error' });
        } else if (payload.standard.title.length > 60) {
          list.push({ field: 'Title', message: `Title is too long (${payload.standard.title.length} chars). Recommend ≤ 60.`, type: 'warning' });
        }

        if (!payload.standard.description) {
          list.push({ field: 'Description', message: 'Meta description tag is missing.', type: 'error' });
        } else {
          const len = payload.standard.description.length;
          if (len < 50) list.push({ field: 'Description', message: `Description is too short (${len} chars). Recommend 50–160.`, type: 'warning' });
          else if (len > 160) list.push({ field: 'Description', message: `Description is too long (${len} chars). Recommend 50–160.`, type: 'warning' });
        }

        if (!payload.standard.canonical) {
          list.push({ field: 'Canonical URL', message: 'Canonical link tag is missing.', type: 'warning' });
        } else if (tab.url) {
          try {
            const urlObj = new URL(tab.url);
            const canonicalObj = new URL(payload.standard.canonical);
            if (urlObj.hostname !== canonicalObj.hostname) {
              list.push({ field: 'Canonical URL', message: `Canonical hostname (${canonicalObj.hostname}) does not match current domain.`, type: 'error' });
            }
          } catch {
            list.push({ field: 'Canonical URL', message: 'Canonical URL is not a valid absolute URL.', type: 'error' });
          }
        }

        if (!payload.og.title) list.push({ field: 'Open Graph', message: 'og:title tag is missing.', type: 'warning' });
        if (!payload.og.description) list.push({ field: 'Open Graph', message: 'og:description tag is missing.', type: 'warning' });
        if (!payload.og.image) list.push({ field: 'Open Graph', message: 'og:image tag is missing.', type: 'warning' });
        if (!payload.twitter.card) list.push({ field: 'Twitter Card', message: 'twitter:card tag is missing.', type: 'warning' });

        setWarnings(list);
      } else {
        throw new Error('No metadata returned from active page.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query page metadata');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

  const copyAllAsJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
        <div className="relative w-11 h-11 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-accent/10 animate-ping" />
          <svg className="animate-spin text-accent relative" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-[10px] font-mono font-semibold text-text-tertiary uppercase tracking-widest">
          Inspecting metadata…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-6 text-center flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-11 h-11 rounded-2xl bg-err/10 border border-err/20 flex items-center justify-center text-err">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed max-w-[260px]">
          {error || 'Failed to inspect metadata values on this webpage.'}
        </p>
        <button
          onClick={fetchMetadata}
          className="px-5 py-2 bg-accent hover:bg-white text-bg-base rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95"
        >
          Retry
        </button>
      </div>
    );
  }

  const errorCount = warnings.filter(w => w.type === 'error').length;
  const warningCount = warnings.filter(w => w.type === 'warning').length;

  // Resolve a display name for the site: prefer og:site_name, then fall back to
  // the hostname derived from the canonical / og:url.
  const deriveHostname = (url: string | undefined | null): string => {
    if (!url) return '';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const siteName =
    data.og.site_name ||
    deriveHostname(data.standard.canonical) ||
    deriveHostname(data.og.url);

  return (
    <div className="space-y-3 animate-fade-in text-left">

      {/* Site preview card */}
      <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-3 flex flex-col gap-3 animate-slide-up relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-28 h-28 bg-accent/8 blur-[45px] rounded-full pointer-events-none" />

        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
          {data.icons.favicon ? (
            <img
              src={data.icons.favicon}
              alt="Favicon"
              className="w-8 h-8 rounded-lg object-contain bg-bg-base border border-border-subtle p-1 shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="w-8 h-8 rounded-lg bg-bg-tertiary border border-border-subtle flex items-center justify-center text-[11px] font-bold text-accent shrink-0">M</span>
          )}
          <div className="min-w-0 flex-1">
            {siteName && (
              <span className="block text-[8px] font-bold text-accent uppercase tracking-[0.12em] truncate leading-none mb-0.5" title={siteName}>
                {siteName}
              </span>
            )}
            <h4 className="text-[12px] font-semibold text-text-primary truncate leading-tight" title={data.standard.title || 'Untitled'}>
              {data.standard.title || 'Untitled'}
            </h4>
            <p className="text-[9px] font-mono text-text-muted truncate mt-0.5">
              {data.standard.canonical || 'No canonical URL'}
            </p>
          </div>
        </div>

        {/* Social card preview */}
        {data.og.title && (
          <div className="border border-border-subtle bg-bg-base rounded-xl overflow-hidden flex flex-col relative z-10">
            {data.og.image ? (
              <div className="w-full h-24 bg-bg-tertiary overflow-hidden relative border-b border-border-subtle">
                <img src={data.og.image} alt="OG Card" className="w-full h-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[7px] font-mono text-text-secondary uppercase tracking-wider select-none">
                  Social Preview
                </span>
              </div>
            ) : (
              <div className="w-full h-12 bg-bg-tertiary flex items-center justify-center border-b border-border-subtle text-[8px] text-text-muted font-mono select-none">
                No Social Card Image
              </div>
            )}
            <div className="p-2.5 min-w-0 space-y-0.5">
              <span className="text-[7px] font-bold font-mono text-accent uppercase tracking-wider block">
                {data.og.site_name || 'Social Card'}
              </span>
              <h5 className="text-[10px] font-semibold text-text-primary truncate" title={data.og.title}>
                {data.og.title}
              </h5>
              <p className="text-[8px] text-text-secondary truncate" title={data.og.description}>
                {data.og.description || 'No social description tag.'}
              </p>
            </div>
          </div>
        )}

        {/* Health summary tiles */}
        <div className="grid grid-cols-3 gap-1.5 relative z-10 select-none">
          <div className={`rounded-lg border px-1.5 py-2 flex flex-col items-center gap-0.5 ${errorCount === 0 ? 'bg-ok/10 border-ok/25' : 'bg-bg-base border-border-subtle'}`}>
            <span className={`text-[13px] font-bold leading-none font-mono ${errorCount === 0 ? 'text-ok' : 'text-text-primary'}`}>{errorCount === 0 ? '✓' : errorCount}</span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-text-tertiary">{errorCount === 0 ? 'Passed' : errorCount === 1 ? 'Error' : 'Errors'}</span>
          </div>
          <div className={`rounded-lg border px-1.5 py-2 flex flex-col items-center gap-0.5 ${warningCount > 0 ? 'bg-accent/10 border-accent/25' : 'bg-bg-base border-border-subtle'}`}>
            <span className={`text-[13px] font-bold leading-none font-mono ${warningCount > 0 ? 'text-accent' : 'text-text-primary'}`}>{warningCount}</span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-text-tertiary">{warningCount === 1 ? 'Warning' : 'Warnings'}</span>
          </div>
          <div className="rounded-lg border bg-bg-base border-border-subtle px-1.5 py-2 flex flex-col items-center gap-0.5">
            <span className="text-[13px] font-bold leading-none font-mono text-text-primary">{data.structuredData.length}</span>
            <span className="text-[7px] font-bold uppercase tracking-widest text-text-tertiary">Schema</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex gap-1 p-1 bg-bg-secondary border border-border-subtle rounded-xl select-none">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer
              ${activeTab === tab
                ? 'bg-accent text-bg-base shadow-[0_2px_8px_rgba(215,207,190,0.2)]'
                : 'text-text-tertiary hover:text-text-primary hover:bg-white/[0.04]'
              }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 overflow-y-auto max-h-[250px] space-y-2.5 pr-0.5 custom-scrollbar">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-2 animate-fade-in">
            {warnings.length === 0 ? (
              <div className="bg-bg-base border border-ok/15 rounded-xl p-5 text-center space-y-2">
                <div className="w-7 h-7 rounded-full bg-ok/10 flex items-center justify-center text-ok mx-auto">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="block text-[10px] font-bold text-text-primary uppercase tracking-widest">
                  SEO Audit Passed
                </span>
                <p className="text-[9px] text-text-secondary leading-relaxed max-w-[220px] mx-auto">
                  This page contains correctly sized titles, custom descriptions, and verified canonical links.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <SectionLabel>Audit Findings</SectionLabel>
                {warnings.map((warn, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-[10px] leading-relaxed
                      ${warn.type === 'error'
                        ? 'bg-err/5 border-err/15 text-err'
                        : 'bg-accent/5 border-accent/15 text-accent'
                      }`}
                  >
                    <span className="font-bold shrink-0 uppercase tracking-widest text-[7px] bg-bg-base px-1.5 py-0.5 border border-current/10 rounded mt-0.5">
                      {warn.field}
                    </span>
                    <span className="flex-1 mt-0.5">{warn.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Standard */}
        {activeTab === 'standard' && (
          <div className="grid grid-cols-1 gap-1.5 animate-fade-in">
            {[
              { label: 'Page Title', value: data.standard.title },
              { label: 'Description', value: data.standard.description },
              { label: 'Keywords', value: data.standard.keywords },
              { label: 'Viewport', value: data.standard.viewport },
              { label: 'Robots Tag', value: data.standard.robots },
              { label: 'Canonical', value: data.standard.canonical },
              { label: 'Language', value: data.standard.language },
              { label: 'Charset', value: data.standard.charset },
              { label: 'Theme Color', value: data.standard.themeColor },
              { label: 'Author', value: data.standard.author },
            ].map(item => (
              <MetaField key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        )}

        {/* Social */}
        {activeTab === 'social' && (
          <div className="space-y-1.5 animate-fade-in">
            <SectionLabel accent>Open Graph</SectionLabel>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { label: 'og:title', value: data.og.title },
                { label: 'og:description', value: data.og.description },
                { label: 'og:image', value: data.og.image },
                { label: 'og:url', value: data.og.url },
                { label: 'og:type', value: data.og.type },
                { label: 'og:site_name', value: data.og.site_name },
                { label: 'og:locale', value: data.og.locale },
              ].map(item => (
                <MetaField key={item.label} label={item.label} value={item.value} />
              ))}
            </div>

            <div className="mt-2">
              <SectionLabel accent>Twitter Cards</SectionLabel>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { label: 'twitter:card', value: data.twitter.card },
                { label: 'twitter:title', value: data.twitter.title },
                { label: 'twitter:description', value: data.twitter.description },
                { label: 'twitter:image', value: data.twitter.image },
                { label: 'twitter:site', value: data.twitter.site },
                { label: 'twitter:creator', value: data.twitter.creator },
              ].map(item => (
                <MetaField key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>
        )}

        {/* SEO/PWA */}
        {activeTab === 'seo' && (
          <div className="space-y-3 animate-fade-in">
            <div className="space-y-1.5">
              <SectionLabel accent>SEO</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-bg-base border border-border-subtle rounded-lg p-2.5 text-center">
                  <span className="block text-[7px] font-bold text-text-tertiary uppercase tracking-widest">Indexing</span>
                  <span className={`block text-[11px] font-bold mt-1 uppercase ${data.seo.index ? 'text-ok' : 'text-err'}`}>
                    {data.seo.index ? 'INDEX' : 'NOINDEX'}
                  </span>
                </div>
                <div className="bg-bg-base border border-border-subtle rounded-lg p-2.5 text-center">
                  <span className="block text-[7px] font-bold text-text-tertiary uppercase tracking-widest">Follow</span>
                  <span className={`block text-[11px] font-bold mt-1 uppercase ${data.seo.follow ? 'text-ok' : 'text-err'}`}>
                    {data.seo.follow ? 'FOLLOW' : 'NOFOLLOW'}
                  </span>
                </div>
              </div>
            </div>

            {data.seo.alternates.length > 0 && (
              <div className="space-y-1.5">
                <SectionLabel>Hreflang Alternates</SectionLabel>
                <div className="bg-bg-base border border-border-subtle rounded-lg overflow-hidden font-mono text-[8px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-border-subtle text-text-muted">
                        <th className="p-2 font-bold uppercase tracking-wider text-[7px]">Lang</th>
                        <th className="p-2 font-bold uppercase tracking-wider text-[7px]">Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.seo.alternates.map((alt, i) => (
                        <tr key={i} className="hover:bg-white/[0.01]">
                          <td className="p-2 font-bold text-accent">{alt.hreflang}</td>
                          <td className="p-2 text-text-secondary truncate max-w-[200px]" title={alt.href}>{alt.href}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <SectionLabel accent>Progressive Web App</SectionLabel>
              <div className="bg-bg-base border border-border-subtle rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-muted text-[8px] font-bold uppercase tracking-widest">Manifest</span>
                  <span className={`font-semibold truncate max-w-[180px] font-mono text-[9px] ${data.pwa.manifest ? 'text-text-primary' : 'text-text-muted italic'}`} title={data.pwa.manifest || 'Not linked'}>
                    {data.pwa.manifest || 'Not linked'}
                  </span>
                </div>
                {data.pwa.backgroundColor && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-muted text-[8px] font-bold uppercase tracking-widest">Background</span>
                    <div className="flex items-center gap-1.5 font-mono text-[9px]">
                      <span className="w-2 h-2 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: data.pwa.backgroundColor }} />
                      <span className="font-semibold text-text-primary">{data.pwa.backgroundColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schemas */}
        {activeTab === 'schemas' && (
          <div className="space-y-3 animate-fade-in">
            {data.structuredData.length === 0 ? (
              <div className="bg-bg-base border border-border-subtle rounded-xl p-5 text-center space-y-1">
                <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  No Schema Found
                </span>
                <p className="text-[9px] text-text-muted max-w-[220px] mx-auto">
                  This page does not include application/ld+json scripts.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar shrink-0 select-none">
                  {data.structuredData.map((schema, i) => {
                    const type = schema['@type'] || schema['@context'] || `Schema #${i+1}`;
                    const displayType = typeof type === 'string' ? type : `JSON-LD #${i+1}`;
                    return (
                      <button
                        key={i}
                        onClick={() => setActiveSchemaIdx(i)}
                        className={`px-2 py-1 rounded text-[7.5px] font-bold uppercase tracking-wider font-mono shrink-0 cursor-pointer border
                          ${activeSchemaIdx === i
                            ? 'bg-accent text-bg-base border-accent shadow-sm'
                            : 'border-border-subtle bg-bg-base text-text-secondary hover:text-text-primary hover:border-border-default'
                          }`}
                      >
                        {displayType}
                      </button>
                    );
                  })}
                </div>

                {data.structuredData[activeSchemaIdx] && (
                  <div className="space-y-2 animate-fade-in">
                    <pre className="font-mono text-[8.5px] bg-bg-base text-accent/90 p-2.5 rounded-lg overflow-x-auto select-text max-h-[160px] overflow-y-auto border border-border-subtle custom-scrollbar leading-relaxed">
                      {JSON.stringify(data.structuredData[activeSchemaIdx], null, 2)}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(data.structuredData[activeSchemaIdx], null, 2))}
                      className="w-full py-1.5 rounded bg-bg-base border border-border-subtle text-[8px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:border-border-default transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Structured Data
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Copy all footer */}
      <div className="pt-1 animate-slide-up select-none">
        <button
          onClick={copyAllAsJson}
          className="w-full h-10 bg-accent hover:bg-white text-bg-base text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-[0_0_12px_rgba(215,207,190,0.15)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
        >
          {copiedAll ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Copy All Metadata
            </>
          )}
        </button>
      </div>

    </div>
  );
}
