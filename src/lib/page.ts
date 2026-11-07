export interface PageLink {
  text: string;
  href: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  links: PageLink[];
  fromSelection: boolean;
}

/**
 * Injected into the active tab with chrome.scripting.executeScript, so it must be
 * self-contained: no imports, no references to anything outside its own body.
 */
export function collectPage(maxLinks: number): PageSnapshot {
  const clean = (s: string) => s.replace(/[ \t\u00a0]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const selection = window.getSelection();
  const selected = selection && !selection.isCollapsed ? selection.toString() : "";

  let root: Element = document.body;
  const main = document.querySelector("main, [role=main], article");
  if (main instanceof HTMLElement && main.innerText.trim().length > 500) root = main;

  const fromSelection = selected.trim().length > 40;
  const text = fromSelection ? selected : (root as HTMLElement).innerText || root.textContent || "";

  const links: { text: string; href: string }[] = [];
  const seen = new Set<string>();
  const range = fromSelection && selection && selection.rangeCount ? selection.getRangeAt(0) : null;
  for (const a of Array.from(root.querySelectorAll("a[href]"))) {
    if (links.length >= maxLinks) break;
    const el = a as HTMLAnchorElement;
    if (range && !range.intersectsNode(el)) continue;
    if (!/^https?:$/.test(el.protocol)) continue;
    const url = new URL(el.href);
    url.hash = "";
    const href = url.href;
    if (seen.has(href)) continue;
    const label = clean(el.innerText || el.getAttribute("aria-label") || el.querySelector("img")?.alt || "");
    if (!label) continue;
    seen.add(href);
    links.push({ text: label.slice(0, 120), href });
  }

  return { url: location.href, title: document.title, text: clean(text), links, fromSelection };
}

/**
 * Renders a snapshot as prompt text within a character budget. Links get at most a
 * quarter of the budget, and only what the text leaves unused beyond that.
 */
export function snapshotToPromptText(
  page: PageSnapshot,
  maxChars: number,
  includeLinks = true,
): { text: string; truncated: boolean } {
  const linkLines = includeLinks ? page.links.map((l) => `- ${l.text} <${l.href}>`) : [];
  const linkBudget = linkLines.length ? Math.floor(maxChars / 4) : 0;

  let linksBlock = "";
  let linksTruncated = false;
  for (const line of linkLines) {
    if (linksBlock.length + line.length + 1 > linkBudget) {
      linksTruncated = true;
      break;
    }
    linksBlock += line + "\n";
  }

  const textBudget = maxChars - linksBlock.length;
  const textTruncated = page.text.length > textBudget;
  const body = textTruncated ? page.text.slice(0, textBudget) : page.text;

  const parts = [body];
  if (linksBlock) parts.push(`\nLinks on the page (text <url>):\n${linksBlock.trimEnd()}`);
  return { text: parts.join("\n"), truncated: textTruncated || linksTruncated };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  if (/^(chrome|edge|brave|about|devtools|view-source|chrome-extension|chrome-search):/i.test(url)) return true;
  return /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url);
}
