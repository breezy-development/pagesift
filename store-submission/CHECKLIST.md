# Upload checklist (about 10 minutes)

Everything referenced here is in this folder. Text to paste is in [`listing.md`](listing.md), in the same
order as the dashboard. Prerequisite: a Chrome Web Store developer account (US$5 paid, contact email
verified, publisher display name **Breezy Development**).

Download this folder first: <https://github.com/breezy-development/pagesift/archive/refs/heads/main.zip>
(or `git clone`), then use the files under `store-submission/`.

## 1. Upload the package (1 min)

1. Open <https://chrome.google.com/webstore/devconsole> → **Items** → **+ New item**.
2. Choose `pagesift-1.0.0.zip` → it uploads and opens the item's **Store listing** page.

## 2. Store listing tab (4 min)

| Field | Paste / upload |
|---|---|
| Description | the text box under "Description" in `listing.md` |
| Category | Productivity → **Tools** |
| Language | English (United States) |
| Store icon | `icon-store-128.png` |
| Global promo video | leave empty |
| Screenshots | `screenshot-1-extract.png`, `screenshot-2-summary.png`, `screenshot-3-settings.png` (in that order) |
| Small promo tile | `promo-small-440x280.png` |
| Marquee promo tile | leave empty |
| Official URL | None |
| Homepage URL | `https://github.com/breezy-development/pagesift` |
| Support URL | `https://github.com/breezy-development/pagesift/issues` |
| Mature content | No |

Name and summary come from the zip's manifest; there is nothing to type for them. Click **Save draft**.

## 3. Privacy tab (3 min)

| Field | Paste / tick |
|---|---|
| Single purpose description | the text box under "Single purpose description" |
| activeTab justification | row `activeTab` in the permissions table |
| scripting justification | row `scripting` |
| storage justification | row `storage` |
| Host permission justification | row "Host permissions" |
| Are you using remote code? | **No, I am not using remote code** |
| Data usage | tick **Authentication information** and **Website content** only |
| Certifications | tick all three |
| Privacy policy URL | `https://breezy-development.github.io/pagesift/privacy.html` |

Click **Save draft**.

## 4. Distribution tab (1 min)

| Field | Choose |
|---|---|
| Payments | Free of charge |
| Visibility | **Unlisted** |
| Distribution | All regions |

Click **Save draft**.

## 5. Submit (1 min)

1. Click **Submit for review**. If the button is grey, the dashboard lists the missing fields in red: fix them and save again.
2. In the dialog, leave "Publish automatically after review" **ticked** (it stays Unlisted, so nobody finds it without the link).
3. Review usually takes a few days. When it's approved, copy the item's URL
   (`https://chromewebstore.google.com/detail/<item-id>`) and send it back so it can go into the README and the Fiverr gig.

## If the review comes back with questions

- "Why activeTab and scripting together?": `activeTab` grants temporary access to the clicked tab; `scripting` is the API used to read its text at that moment. No content scripts, no host access to websites.
- "Authentication information": it's the user's own provider key, stored only in `chrome.storage.local` and sent only to that provider.
- The source is public at <https://github.com/breezy-development/pagesift>, and the shipped JavaScript is unminified.
