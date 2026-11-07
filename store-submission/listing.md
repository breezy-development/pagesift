# Chrome Web Store listing: PageSift

Final copy-paste answers for the Developer Dashboard, field by field. For the order to do things in, see
[`CHECKLIST.md`](CHECKLIST.md).

## Package

**File to upload:** `pagesift-1.0.0.zip` (in this folder; `npm run package` rebuilds it reproducibly).

## Store listing tab

**Name** (read from the manifest, 34/75 chars): PageSift: AI Page to CSV & Summary

**Short description / summary** (read from the manifest `description`, 120/132 chars; not editable in the dashboard):
Turn any web page into a clean CSV table or a short summary with AI, using your own OpenAI, Anthropic or OpenRouter key.

**Description** (paste everything inside the box):

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

Open source (MIT): https://github.com/breezy-development/pagesift
Questions or ideas: https://github.com/breezy-development/pagesift/issues
```

**Category:** Productivity → Tools (alternative: Productivity → Workflow & Planning)

**Language:** English (United States)

**Graphics** (all in this folder):

| Dashboard field | File | Size |
|---|---|---|
| Store icon | `icon-store-128.png` | 128×128 (96×96 artwork + transparent padding, per CWS guidance) |
| Screenshot 1 | `screenshot-1-extract.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-summary.png` | 1280×800 |
| Screenshot 3 | `screenshot-3-settings.png` | 1280×800 |
| Small promo tile | `promo-small-440x280.png` | 440×280 |
| Marquee promo tile | leave empty (optional, only used for featuring) | 1400×560 |
| Global promo video | leave empty | |

Screenshots show the real popup and settings page; the page content is a fictional demo store and the
AI reply is canned (see README, "About the screenshots").

**Official URL:** leave as "None" (it needs a Search Console–verified site).

**Homepage URL:** https://github.com/breezy-development/pagesift

**Support URL:** https://github.com/breezy-development/pagesift/issues

**Mature content:** No.

## Privacy practices tab

**Single purpose description:**

```text
Turn the content of the current web page into a structured table (CSV) or a short summary, using an AI model the user chooses with their own API key.
```

**Permission justifications** (one box per permission):

| Box | Paste |
|---|---|
| `activeTab` | Lets PageSift read the current tab only after the user clicks the toolbar icon, so it can send that page's text to the user's chosen AI provider. No access to other tabs or to background browsing. |
| `scripting` | Runs one small, bundled function in the active tab (only after the user's click) to collect the page's visible text and links. No content scripts are declared and nothing is injected otherwise. |
| `storage` | Saves the user's settings, their own API key (chrome.storage.local, never synced) and last-used columns, and keeps the latest result per tab in chrome.storage.session so it survives closing the popup. |
| Host permissions | Only optional host permissions are declared (https://api.openai.com/*, https://api.anthropic.com/*, https://openrouter.ai/*). Each is requested at runtime, only for the provider the user selects, so the extension can send that provider the API request. Nothing is requested at install. |

**Are you using remote code?** No, I am not using remote code. (Justification box, if shown: "All JavaScript is bundled in the package; the CSP is script-src 'self'.")

**Data usage: what user data do you plan to collect from users now or in the future?** Tick only these two:

| Category | Tick? | Why |
|---|---|---|
| Personally identifiable information | No | |
| Health information | No | |
| Financial and payment information | No | |
| Authentication information | **Yes** | The user's own AI provider API key, stored locally and sent only to that provider. |
| Personal communications | No | |
| Location | No | |
| Web history | No | |
| User activity | No | |
| Website content | **Yes** | The text and links of the current page are sent to the user-selected AI provider when the user clicks Extract or Summarize. |

**Certifications** (tick all three; all true):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

The page content does go to the provider the user picks, under the user's own account. That is the
item's single purpose, and the description and privacy policy say so. Breezy Development never receives it.

**Privacy policy URL:** https://breezy-development.github.io/pagesift/privacy.html

## Distribution tab

- **Payments:** Free of charge
- **Visibility:** **Unlisted** (only people with the link can find or install it; can be switched to Public later)
- **Distribution regions:** All regions

## Account tab (one-time, done by the account owner)

- **Publisher display name:** Breezy Development
- **Contact email:** must be verified before the first submission.
- **Trader / non-trader declaration** (EU Digital Services Act): pick per the owner's decision. A free, unmonetised portfolio item is usually "non-trader"; "trader" shows a business address and phone publicly.
