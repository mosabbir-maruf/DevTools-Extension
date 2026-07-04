const utilities = [
  {
    tag: 'Screenshots',
    desc: 'Full-page scroll stitching, visible viewport grabs, and custom region selection with device presets. Export to PNG, JPEG, WebP, PDF, or SVG.',
  },
  {
    tag: 'Fonts',
    desc: 'Hover any element to read font family, size, weight, color, line-height, letter-spacing, and the underlying HTML tag in real time.',
  },
  {
    tag: 'Colors',
    desc: 'Pick any pixel on screen with the native EyeDropper API and copy HEX, RGB, or HSL values in a single click.',
  },
  {
    tag: 'Meta',
    desc: 'Audit standard headers, Open Graph cards, Twitter/X metadata, manifests, hreflang alternates, and JSON-LD structured schemas.',
  },
];

const principles = [
  { k: '01', title: 'Local by default', desc: 'Every capture, inspection, and conversion runs in your browser. Nothing is ever uploaded.' },
  { k: '02', title: 'Zero tracking', desc: 'No analytics, no telemetry, no accounts. Nothing to sign up for, nothing to opt out of.' },
  { k: '03', title: 'Open source', desc: 'Released under the MIT license. Read the source, file an issue, or send a pull request.' },
  { k: '04', title: 'Works offline', desc: 'Because processing is local, the toolkit keeps working with or without a connection.' },
];

const stats = [
  { value: '4', label: 'Utilities' },
  { value: '5', label: 'Export formats' },
  { value: '0', label: 'Servers' },
  { value: 'MIT', label: 'License' },
];

export default function About() {
  return (
    <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-12 sm:py-20 animate-fade-in">
      <div>

        {/* Hero — editorial, left-aligned */}
        <section className="border-b border-border-subtle pb-12 sm:pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-accent-ink font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">About</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
            <h1 className="lg:col-span-8 text-[34px] sm:text-[56px] font-semibold tracking-tight leading-[1.05] text-text-primary">
              A developer toolkit that respects your <span className="text-accent-ink italic">privacy.</span>
            </h1>
            <p className="lg:col-span-4 text-text-secondary text-[15px] leading-relaxed">
              A free, open-source Chrome extension that brings four everyday web utilities into one
              lightweight popup — running entirely inside your browser.
            </p>
          </div>
        </section>

        {/* Stat strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 border-b border-border-subtle">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-4 sm:px-6 py-8 sm:py-10 border-border-subtle ${
                i % 2 === 0 ? 'border-r' : ''
              } sm:border-r sm:last:border-r-0 ${
                i >= 2 ? 'border-t sm:border-t-0' : ''
              }`}
            >
              <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary">{s.value}</div>
              <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-text-tertiary">{s.label}</div>
            </div>
          ))}
        </section>

        {/* Mission */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 py-12 sm:py-20 border-b border-border-subtle">
          <div className="lg:col-span-4">
            <span className="text-[10px] font-mono font-bold text-text-tertiary uppercase tracking-widest">[ Why it exists ]</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-light tracking-tight text-text-primary">Built for the browser, not the cloud.</h2>
          </div>
          <div className="lg:col-span-8 space-y-4 text-text-secondary text-[15px] leading-relaxed lg:text-[16px]">
            <p>
              Most screenshot and design tools ship your content to a remote server before you get a result.
              For sensitive pages, internal dashboards, or client work, that trade-off is rarely acceptable.
            </p>
            <p>
              DevTools takes the opposite approach. It keeps the tools developers and designers reach for
              every day close at hand, and processes everything on-device. No uploads, no queues, no waiting —
              just fast, reliable output you can trust with any page.
            </p>
          </div>
        </section>

        {/* Utilities — numbered editorial list */}
        <section className="py-12 sm:py-20 border-b border-border-subtle">
          <div className="flex items-baseline justify-between mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-text-primary">Four utilities, one extension</h2>
            <span className="hidden sm:block text-[10px] font-mono uppercase tracking-widest text-text-tertiary">01 — 04</span>
          </div>
          <div className="divide-y divide-border-subtle border-y border-border-subtle">
            {utilities.map((u, i) => (
              <div key={u.tag} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 py-6 sm:py-7 group">
                <div className="sm:col-span-1 font-mono text-xs font-bold text-accent-ink">{String(i + 1).padStart(2, '0')}</div>
                <div className="sm:col-span-3">
                  <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-ink transition-colors">{u.tag}</h3>
                </div>
                <p className="sm:col-span-8 text-[14px] text-text-secondary leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Principles — compact numbered grid */}
        <section className="py-12 sm:py-20">
          <span className="text-[10px] font-mono font-bold text-text-tertiary uppercase tracking-widest">[ What we stand for ]</span>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {principles.map((p) => (
              <div key={p.k} className="space-y-3">
                <span className="font-mono text-[11px] font-bold text-text-tertiary">{p.k}</span>
                <div className="w-full h-px bg-border-subtle" />
                <h3 className="text-sm font-semibold text-text-primary">{p.title}</h3>
                <p className="text-[13px] text-text-secondary leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
