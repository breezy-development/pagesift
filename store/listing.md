# Chrome Web Store listing: PageSift

Copy-paste answers for the Developer Dashboard. Nothing has been submitted.

## Store listing tab

**Name** (from manifest, 35/75 chars): PageSift: AI Page to CSV & Summary

**Summary** (manifest `description`, 118/132 chars):
Turn any web page into a clean CSV table or a short summary with AI, using your own OpenAI, Anthropic or OpenRouter key.

**Category:** Tools (alternatives: Workflow & Planning)

**Language:** English

**Description:**

```text
PageSift turns the page you're looking at into a clean spreadsheet, or a short summary, in one click.

EXTRACT A TABLE
Type the columns you want, like "Name, Price, Rating, URL", or pick a preset (products, articles, events, job listings, the main table on the page). AI reads the page and fills in one row per item. Leave the columns blank and it picks sensible ones for you.
• Download CSV (opens cleanly in Excel, Google Sheets and Numbers)
• Copy for Sheets: paste straight into a spreadsheet
• Copy JSON for developers
• Select part of a page first to extract only that part

SUMMARIZE
Get the key points, a TL;DR, or just the action items (deadlines, prices, decisions) from any article or document.

BRING YOUR OWN KEY
PageSift works with your own API key from OpenAI, Anthropic or OpenRouter. You pay the provider directly, usually a fraction of a cent per page with small models. There's no PageSift account and no subscription.

PRIVATE BY DESIGN
• No PageSift server. The page goes straight from your browser to the AI provider you picked.
• Reads a page only when you click, using Chrome's activeTab permission. No access to your browsing in the background.
• Your key is stored only in this browser (never synced) and sent only to its provider.
• No analytics, no tracking, no remote code.

Good for: price and product research, lead lists from directories, event calendars, job boards, reading lists, research notes, and turning any messy page into data.

Questions or ideas? Use the Support tab.
```

**Graphics** (all in `store/`):

| Asset | File | Size |
|---|---|---|
| Store icon | `icon-store-128.png` | 128×128 (96×96 artwork + transparent padding, per CWS guidance) |
| Screenshot 1 | `screenshot-1-extract.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-summary.png` | 1280×800 |
| Screenshot 3 | `screenshot-3-settings.png` | 1280×800 |
| Small promo tile | `promo-small-440x280.png` | 440×280 |
| Marquee (optional) | not made | 1400×560 |

Screenshots show the real popup and settings page; the page content is a fictional demo store and the
AI reply is canned (see README, "About the screenshots").

## Privacy practices tab

**Single purpose:**
Turn the content of the current web page into a structured table (CSV) or a short summary, using an AI model the user chooses with their own API key.

**Permission justifications:**

- `activeTab`: Lets PageSift read the current tab only after the user clicks the toolbar icon, so it can send that page's text to the user's AI provider. No access to other tabs or background browsing.
- `scripting`: Runs a small function in the active tab (only after the click) to collect the page's visible text and links. No code is injected into pages otherwise.
- `storage`: Saves the user's settings, API key (in chrome.storage.local, not synced) and last-used columns, and keeps the latest result per tab in session storage so it survives closing the popup.
- Optional host permissions (`https://api.openai.com/*`, `https://api.anthropic.com/*`, `https://openrouter.ai/*`): Requested at runtime only for the provider the user selects, so the extension can send API requests to it. Not requested at install.

**Remote code:** No, I am not using remote code. All JavaScript is bundled in the package.

**Data usage** (check these boxes):

- Website content: **Yes** (page text and links are sent to the user-selected AI provider when the user clicks Extract or Summarize).
- Authentication information: **Yes** (the user's own API key, stored locally and sent only to that provider).
- Everything else (personally identifiable info, health, financial, personal communications, location, web history, user activity): **No**.

**Certifications** (all true for this extension):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

The page content does go to the provider the user picks, under the user's own account. That counts as
part of the single purpose, and the description and privacy policy say so.

**Privacy policy URL:** host `src/privacy.html` publicly (e.g. GitHub Pages or the Breezy Development
site) and paste that URL here. The same page ships inside the extension at `privacy.html`.

## Distribution tab

- Visibility: Public (or Unlisted for a soft launch / Fiverr portfolio link)
- Regions: All
- Pricing: Free (a paid tier can be added later; see README, "Freemium path")
