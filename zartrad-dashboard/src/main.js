// src/main.js
import './style.css';
import { fetchAndVerifyByCID } from "./dataLoader.js";
import { getLatestOnChain, getSnapshotCount } from './contract.js';
import { fetchAllSnapshots, buildEquitySeries, computePerformance } from "./history.js";

// ---------- THEME ----------
const THEME_KEY = 'theme';
function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(THEME_KEY, t);
}
let theme = getInitialTheme();
applyTheme(theme);
function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
}
// ---------- /THEME ----------

let activeTab = 'overview'; // 'overview' | 'performance'

const fmtUsd = (s) => {
  if (s == null) return "—";
  const n = Number(s);
  return isFinite(n)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
    : s;
};
const fmtPct = (s) => (s == null ? "—" : `${s}%`);
const symOpt = (p) => `${p.symbol} ${p.expiry} ${p.strike} ${p.right?.[0] ?? ""}`.trim();

function kpiRow(acct, all) {
  const cells = [
    { label: "Net Liquidation (Account 1)", v: fmtUsd(acct?.NetLiquidation?.value) },
    { label: "Total Cash (Account 1)",      v: fmtUsd(acct?.TotalCashValue?.value) },
    { label: "Buying Power (Account 1)",    v: fmtUsd(acct?.BuyingPower?.value) },
    { label: "Unrealized PnL (All)",        v: fmtUsd(all?.UnrealizedPnL?.value) },
    { label: "Realized PnL (All)",          v: fmtUsd(all?.RealizedPnL?.value) },
  ];
  return `
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:12px 0 20px;">
      ${cells.map(c => `
        <div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;padding:12px;">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${c.label}</div>
          <div style="font-size:18px;font-weight:700;">${c.v}</div>
        </div>`).join("")}
    </div>`;
}

function positionsTable(positions, baseCCY) {
  if (!Array.isArray(positions) || positions.length === 0) {
    return `<div style="color:var(--muted);">No open positions</div>`;
  }
  const rows = positions.map(p => `
    <tr>
      <td>${p.secType === "OPT" ? symOpt(p) : p.symbol}</td>
      <td>${p.secType}</td>
      <td style="text-align:right;">${p.position}</td>
      <td style="text-align:right;">${p.avgPrice ?? "—"}</td>
      <td style="text-align:right;">${p.lastPrice ?? "—"}</td>
      <td style="text-align:right;">${fmtPct(p.pctChange)}</td>
      <td style="text-align:right;">${fmtUsd(p.unrealizedPnL)} ${baseCCY || ""}</td>
    </tr>
  `).join("");
  return `
  <div style="overflow:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="text-align:left;border-bottom:1px solid var(--table-border);">
          <th>Symbol</th><th>Type</th><th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Avg</th><th style="text-align:right;">Last</th>
          <th style="text-align:right;">% Chg</th><th style="text-align:right;">PnL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function nyTradingDay(isoUtc) {
  if (!isoUtc || isoUtc === "n/a") return "n/a";
  const d = new Date(isoUtc);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d); // YYYY-MM-DD
}

function nyTimestamp(isoUtc) {
  if (!isoUtc || isoUtc === "n/a") return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(new Date(isoUtc));
}

// ---------- RENDERERS ----------
async function renderOverview() {
  const app = document.querySelector('#app');
  app.innerHTML = "<h1>Zartrad Dashboard</h1><p>Loading…</p>";

  try {
    const { cid, sha256File, timestamp } = await getLatestOnChain();
    if (!cid) { app.innerHTML = "<h1>Zartrad Dashboard</h1><p>No snapshots on-chain yet.</p>"; return; }

    const tsOnChain = timestamp ? new Date(timestamp).toLocaleString() : "n/a";
    const v = await fetchAndVerifyByCID(cid, sha256File);
    const verified = v.ok && !!v.sha256_onchain;

    const asOf = v.json?.as_of_utc ?? "n/a";
    const asOfNY   = nyTimestamp(asOf);
    const tradeDay = nyTradingDay(asOf);
    const payload = v.json?.payload || {};
    const accounts = payload.accounts || {};
    const acctKey  = Object.keys(accounts).find(k => k !== "All") || null;
    const acct     = acctKey ? accounts[acctKey] : {};
    const all      = accounts["All"] || {};
    const base = v.json?.account_base_ccy || v.json?.meta?.currency || "USD";
    const polyscanAddr = `https://amoy.polygonscan.com/address/${import.meta.env.VITE_REGISTRY_ADDR}`;

    app.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px;margin:14px 0;">
        <div style="flex:1 1 auto;">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <h1 style="margin:0;">Zartrad Dashboard</h1>
            <span class="badge" style="background:${verified ? 'var(--badge-ok-bg)' : 'var(--badge-bad-bg)'};">
              ${verified ? 'Verified' : 'Unverified'}
            </span>
          </div>
          <div style="color:var(--muted);margin-top:6px;">
            As of ${tradeDay} Close <span style="opacity:.8">• UTC: ${asOf} • NY: ${asOfNY}</span>
          </div>
        </div>

        <div style="flex:0 0 auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button id="tabOverview" ${activeTab==='overview'?'disabled':''}>Overview</button>
          <button id="tabPerf" ${activeTab==='performance'?'disabled':''}>Performance</button>
          <a href="${v.url}" target="_blank">IPFS</a>
          <a href="${polyscanAddr}#transactions" target="_blank">Polygonscan</a>
          <button id="themeToggle" title="Toggle theme">${theme === 'dark' ? 'Light' : 'Dark'}</button>
        </div>
      </div>

      ${kpiRow(acct, all)}

      <h2 style="margin:10px 0;">Positions</h2>
      ${positionsTable(payload.positions || [], base)}

      <details style="margin-top:18px;">
        <summary>Tech verification details</summary>
        <div style="margin-top:10px;font-size:13px;color:var(--muted);">
          <div><b>On-chain CID:</b> <code style="word-break:break-all;">${cid}</code></div>
          <div><b>On-chain ts:</b> ${tsOnChain}</div>
          <div style="margin-top:8px;"><b>Hashes</b></div>
          <ul>
            <li><b>Expected (on-chain):</b> <code>${v.sha256_onchain ?? 'n/a'}</code></li>
            <li><b>Computed file-bytes:</b> <code>${v.sha256_file}</code></li>
            <li><b>Computed canonical (no sha256):</b> <code>${v.sha256_canonical}</code></li>
            ${v.sha256_expected ? `<li><b>Expected (in-file):</b> <code>${v.sha256_expected}</code></li>` : ""}
            <li><b>Mode:</b> ${v.mode || 'n/a'}</li>
          </ul>
        </div>
      </details>
    `;

    wireHeaderEvents();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<h1>Zartrad Dashboard</h1><p style="color:#f55;">${err.message}</p>`;
  }
}

async function renderPerformance() {
  const app = document.querySelector('#app');
  app.innerHTML = "<h1>Performance</h1><p>Loading history…</p>";

  try {
    // 1) Load history (verified when possible)
    const snaps = await fetchAllSnapshots();
    const loaded = snaps.length;

    // 2) Try to read total snapshot count from chain (guarded)
    let total = null;
    try {
      total = await getSnapshotCount();
    } catch (e) {
      console.warn("getSnapshotCount failed (display only):", e?.message || e);
    }

    // 3) Build equity series for charts/stats
    const eq = buildEquitySeries(snaps);
    const perf = computePerformance(eq); // placeholder for now

    const pct = (x, dp=2) => (x == null ? "—" : (x*100).toFixed(dp) + "%");
    const num = (x, dp=2) => (x == null ? "—" : x.toFixed(dp));

    const first = eq.length ? eq[0].date : "n/a";
    const last  = eq.length ? eq[eq.length - 1].date : "n/a";

    app.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin:14px 0;">
        <h1 style="margin:0;">Performance</h1>
        <span style="margin-left:auto;display:flex;gap:8px;align-items:center;">
          <button id="tabOverview" ${activeTab==='overview'?'disabled':''}>Overview</button>
          <button id="tabPerf" ${activeTab==='performance'?'disabled':''}>Performance</button>
          <button id="themeToggle" title="Toggle theme">${theme === 'dark' ? 'Light' : 'Dark'}</button>
        </span>
      </div>

      <p style="color:var(--muted);">
        History range: ${first} → ${last}
        • ${perf.stats.days ?? 0} trading days
        ${typeof total === 'number' ? `• Loaded ${loaded}/${total} snapshots` : ``}
      </p>

      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:12px 0 20px;">
        ${[
          {label:"Since Inception", v:pct(perf.stats.since_inception)},
          {label:"YTD",             v:pct(perf.stats.ytd)},
          {label:"Ann. Return",     v:pct(perf.stats.annual_return)},
          {label:"Ann. Vol",        v:pct(perf.stats.annual_vol)},
          {label:"Sharpe",          v:num(perf.stats.sharpe)}
        ].map(c => `
          <div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;padding:12px;">
            <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${c.label}</div>
            <div style="font-size:18px;font-weight:700;">${c.v}</div>
          </div>`).join("")}
      </div>

      <pre style="text-align:left;background:var(--card-bg);border:1px solid var(--card-border);border-radius:8px;padding:12px;overflow:auto;max-height:320px;">
    ${JSON.stringify(eq.slice(-10), null, 2)}
      </pre>
    `;

    wireHeaderEvents();

  } catch (err) {
    console.error(err);
    app.innerHTML = `<h1>Performance</h1><p style="color:#f55;">${err.message}</p>`;
  }
}

function wireHeaderEvents() {
  const t = document.getElementById('themeToggle');
  if (t) t.addEventListener('click', () => {
    toggleTheme();
    t.textContent = theme === 'dark' ? 'Light' : 'Dark';
  });
  const o = document.getElementById('tabOverview');
  if (o) o.addEventListener('click', async () => {
    activeTab = 'overview';
    await renderOverview();
  });
  const p = document.getElementById('tabPerf');
  if (p) p.addEventListener('click', async () => {
    activeTab = 'performance';
    await renderPerformance();
  });
}

// ---------- BOOT ----------
if (activeTab === 'overview') {
  renderOverview();
} else {
  renderPerformance();
}