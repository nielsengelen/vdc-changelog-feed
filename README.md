# VDC Changelog Feed

Unofficial RSS/JSON feeds + static dashboard for the [Veeam Data Cloud changelog](https://www.veeam.com/veeam-data-cloud/change-log.html).

A GitHub Action polls the changelog every 6 hours and publishes static feeds to GitHub Pages. Nothing to install — subscribe with any RSS reader, Outlook, Slack (`/feed add <url>`), or a Teams RSS connector.

## Feeds

Once deployed at `https://<user>.github.io/<repo>/`:

| Feed | RSS | JSON |
|---|---|---|
| All workloads | `feeds/all.xml` | `feeds/all.json` |
| VDC General | `feeds/general.xml` | `feeds/general.json` |
| Microsoft 365 | `feeds/m365.xml` | `feeds/m365.json` |
| Microsoft Azure | `feeds/azure.xml` | `feeds/azure.json` |
| Microsoft Entra ID | `feeds/entra.xml` | `feeds/entra.json` |
| Salesforce | `feeds/salesforce.xml` | `feeds/salesforce.json` |
| Vault | `feeds/vault.xml` | `feeds/vault.json` |

The dashboard at the site root shows the same data with per-workload tabs.

## Setup

1. Push this folder to a new GitHub repository.
2. Repo **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/docs`.
3. **Actions** tab → *Update feeds* → *Run workflow* (first run populates `docs/feeds/`).

The scheduled workflow (`.github/workflows/update-feeds.yml`) then keeps the feeds current; it only commits when the changelog actually changed.

## Local development

```bash
node build-feeds.js          # fetch + write docs/feeds/
python -m http.server -d docs 8080   # serve the dashboard locally
```

No dependencies (plain Node 18+).

## Notes

- Data source is the JSON endpoint the official changelog page itself uses (`/services/change-log/list`). It is not a documented public API — if Veeam changes it, `build-feeds.js` is the only place to fix.
- All changelog content © Veeam Software.
- Code is [MIT licensed](LICENSE.md).
