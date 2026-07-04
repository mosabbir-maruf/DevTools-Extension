// Serverless function (Vercel) that forwards contact-form submissions to a
// Telegram chat. The bot token and chat id live ONLY in server-side environment
// variables and are never exposed to the browser.
//
// Required environment variables (set in the Vercel project settings):
//   TELEGRAM_BOT_TOKEN  - the token from @BotFather
//   TELEGRAM_CHAT_ID    - the chat/channel id that should receive messages

// Best-effort in-memory rate limiter. Serverless instances are ephemeral and
// not shared, so this only throttles bursts hitting the same warm instance —
// it is a lightweight guard, not a substitute for a real WAF.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const hits = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

// Escape user content so it can't inject Telegram HTML markup.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    // Don't leak which variable is missing.
    console.error('Telegram environment variables are not configured.');
    return res.status(500).json({ error: 'Server is not configured.' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
  }

  // Body may arrive parsed or as a raw string depending on runtime.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const { name, email, topic, message, company } = body;

  // Honeypot: real users never see or fill the "company" field. Bots do.
  // Silently accept and drop so the bot thinks it succeeded.
  if (company) {
    return res.status(200).json({ ok: true });
  }

  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  const cleanTopic = String(topic || 'General Inquiry').trim();
  const cleanMessage = String(message || '').trim();

  const fields = [];
  if (cleanName.length < 2 || cleanName.length > 100) fields.push('name');
  if (!isEmail(cleanEmail) || cleanEmail.length > 200) fields.push('email');
  if (cleanMessage.length < 5 || cleanMessage.length > 4000) fields.push('message');
  if (cleanTopic.length > 60) fields.push('topic');

  if (fields.length) {
    return res.status(400).json({ error: 'Invalid input.', fields });
  }

  // Capture the originating site so we know where the message came from.
  const siteUrl = String(req.headers['origin'] || req.headers['referer'] || 'unknown').trim();

  const text =
    '<b>📨 New DevTools contact</b>\n\n' +
    `<b>Message From:</b> ${escapeHtml(siteUrl)}\n\n` +
    `<b>Name:</b> ${escapeHtml(cleanName)}\n` +
    `<b>Email:</b> ${escapeHtml(cleanEmail)}\n` +
    `<b>Topic:</b> ${escapeHtml(cleanTopic)}\n\n` +
    `<b>Message:</b>\n${escapeHtml(cleanMessage)}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!tgRes.ok) {
      const detail = await tgRes.text().catch(() => '');
      console.error('Telegram API error:', tgRes.status, detail);
      return res.status(502).json({ error: 'Failed to deliver message.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram request failed:', err);
    return res.status(502).json({ error: 'Failed to deliver message.' });
  }
}
