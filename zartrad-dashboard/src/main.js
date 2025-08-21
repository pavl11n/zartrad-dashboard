// src/main.js
import './style.css';
import { fetchAndVerifyByCID } from "./dataLoader.js";
import { getLatestOnChain } from './contract.js';

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
        <div style="background:#111;border:1px solid #333;border-radius:10px;padding:12px;">
          <div style="font-size:12px;color:#aaa;margin-bottom:6px;">${c.label}</div>
          <div style="font-size:18px;font-weight:700;">${c.v}</div>
        </div>`).join("")}
    </div>`;
}

function positionsTable(positions, baseCCY) {
  if (!Array.isArray(positions) || positions.length === 0) {
    return `<div style="color:#aaa;">No open positions</div>`;
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
        <tr style="text-align:left;border-bottom:1px solid #333;">
          <th>Symbol</th><th>Type</th><th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Avg</th><th style="text-align:right;">Last</th>
          <th style="text-align:right;">% Chg</th><th style="text-align:right;">U/PnL</th>
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

async function renderSnapshot() {
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
      <h1 style="margin-bottom:14px;">Zartrad Dashboard</h1>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <span style="padding:6px 10px;border-radius:999px;font-weight:700;
                     ${verified ? 'background:#0a2; color:#fff;' : 'background:#642; color:#fff;'}">
          ${verified ? 'Verified' : 'Unverified'}
        </span>
        <span style="color:#bbb;">UTC: ${asOf} · NY: ${asOfNY} (Trading day: ${tradeDay})</span>
        <span style="margin-left:auto;">
          <a href="${v.url}" target="_blank">IPFS</a> ·
          <a href="${polyscanAddr}#transactions" target="_blank">Polygonscan</a>
        </span>
      </div>

      ${kpiRow(acct, all)}

      <h2 style="margin:10px 0;">Positions</h2>
      ${positionsTable(payload.positions || [], base)}

      <details style="margin-top:18px;">
        <summary>Tech verification details</summary>
        <div style="margin-top:10px;font-size:13px;color:#bbb;">
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
  } catch (err) {
    console.error(err);
    app.innerHTML = `<h1>Zartrad Dashboard</h1><p style="color:#f55;">${err.message}</p>`;
  }
}

renderSnapshot();