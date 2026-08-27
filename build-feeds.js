/**
 * build-feeds.js — fetches the Veeam Data Cloud changelog (same JSON endpoint
 * the official page uses) and writes static RSS + JSON feeds into docs/feeds/.
 * Plain Node 18+, no dependencies. Run: node build-feeds.js
 *
 * Output is deterministic (no build timestamps) so the CI commit step can
 * skip runs where nothing changed.
 */

const fs = require("fs");
const path = require("path");

const WORKLOADS = [
  { id: "general",    slug: "veeam-data-cloud", label: "VDC General" },
  { id: "m365",       slug: "microsoft-365",    label: "Microsoft 365" },
  { id: "azure",      slug: "azure",            label: "Microsoft Azure" },
  { id: "entra",      slug: "entra-id",         label: "Microsoft Entra ID" },
  { id: "salesforce", slug: "salesforce",       label: "Salesforce" },
  { id: "vault",      slug: "vault",            label: "Vault" },
];

const API_URL = "https://www.veeam.com/services/change-log/list";
const SITE_URL = "https://www.veeam.com/veeam-data-cloud/change-log.html";
const OUT_DIR = path.join(__dirname, "docs", "feeds");

async function fetchWorkload(w) {
  const url = `${API_URL}?product=vdc&workloads=${w.slug}&offset=0&limit=50`;
  const res = await fetch(url, {
    headers: { "User-Agent": "vdc-changelog-feed (github action)" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${w.id}: HTTP ${res.status}`);
  const data = await res.json();
  const cards = data.changeLogCards || [];
  if (cards.length === 0) throw new Error(`${w.id}: API returned no entries`);

  return cards.map(card => ({
    date: card.releaseDate || "",
    title: (card.title || "").trim(),
    category: mapCategory(card),
    tags: card.categories || [],
    description: htmlToText(card.description || ""),
    pageUrl: card.pageUrl ? `https://www.veeam.com${card.pageUrl}` : SITE_URL,
    workload: w.id,
    workloadLabel: w.label,
  }));
}

function mapCategory(card) {
  if ((card.categories || []).includes("Security")) return "Security";
  switch (card.type) {
    case "New":      return "New Feature";
    case "Enhanced": return "Enhancement";
    case "Fixed":    return "Fix";
    default:         return card.type || "Other";
  }
}

// Convert the API's AEM description HTML into plain text, one "• " line per <li>.
function htmlToText(html) {
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|ul|ol|br|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/• *\n/g, "• ")
    .trim();
}

// ── RSS 2.0 ───────────────────────────────────────────────────────────────────
function escXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rssDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toUTCString().replace("GMT", "+0000");
}

function buildRss(title, entries) {
  const items = entries.map(e => `    <item>
      <title>${escXml(`[${e.workloadLabel}] ${e.title}`)}</title>
      <link>${escXml(e.pageUrl)}</link>
      <guid isPermaLink="false">${escXml(`${e.workload}|${e.date}|${e.title}`)}</guid>
      <pubDate>${rssDate(e.date)}</pubDate>
      <category>${escXml(e.category)}</category>
      <description>${escXml(e.description)}</description>
    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escXml(title)}</title>
    <link>${escXml(SITE_URL)}</link>
    <description>${escXml(`Unofficial feed of the Veeam Data Cloud changelog — ${title}`)}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const byDateDesc = (a, b) => b.date.localeCompare(a.date);
  const all = {};

  for (const w of WORKLOADS) {
    const entries = (await fetchWorkload(w)).sort(byDateDesc);
    all[w.id] = { label: w.label, entries };
    fs.writeFileSync(path.join(OUT_DIR, `${w.id}.json`), JSON.stringify({ workload: w.id, label: w.label, entries }, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, `${w.id}.xml`), buildRss(`Veeam Data Cloud Changelog — ${w.label}`, entries));
    console.log(`${w.id}: ${entries.length} entries`);
  }

  const combined = Object.values(all).flatMap(w => w.entries).sort(byDateDesc).slice(0, 100);
  fs.writeFileSync(path.join(OUT_DIR, "all.json"), JSON.stringify({ workloads: all }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "all.xml"), buildRss("Veeam Data Cloud Changelog — All Workloads", combined));
  console.log(`all: ${combined.length} entries`);
})().catch(err => { console.error("FAIL:", err.message); process.exit(1); });
