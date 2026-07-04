/**
 * Ensure the content script is running in the target tab.
 *
 * First pings the tab; if the content script is already present it responds and
 * we return immediately. Otherwise the script is injected programmatically and
 * given a brief moment to initialize before returning. Returns `false` when
 * injection is not possible (e.g. restricted pages).
 */
export async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
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
