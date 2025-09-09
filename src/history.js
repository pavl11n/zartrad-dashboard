// src/history.js
import { fetchFromAPI } from "./dataLoader.js";
import { getSnapshotCount, getSnapshotByIndex } from "./contract.js";
import { fetchAndVerifyByCID } from "./dataLoader.js";

const isZeroHash = (h) => !h || /^0x0+$/i.test(h);

async function loadSnapshot(i) {
  const { cid, sha256File, timestamp } = await getSnapshotByIndex(i);
  const expected = isZeroHash(sha256File) ? null : sha256File;

  // retry up to 3 times; your loader already rotates 3 gateways each time
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetchAndVerifyByCID(cid, expected);
      if (r?.json) return { cid, sha256File, timestamp, json: r.json, verified: !!r.ok };
    } catch (e) {
      lastErr = e;
    }
  }
  console.warn("snapshot fetch failed @ index", i, (lastErr && lastErr.message) || lastErr);
  return null;
}

// --- Replace fetchAllSnapshots with SQLite API version ---
export async function fetchAllSnapshots() {
  try {
    const snaps = await fetchFromAPI();
    // Format them like before: array of {timestamp, json, verified, ...}
    return snaps.map(s => ({
      cid: null, // not needed anymore
      sha256File: s.sha256,
      timestamp: new Date(s.as_of_utc).getTime(),
      json: s.data,
      verified: true
    }));
  } catch (e) {
    console.error("fetchAllSnapshots API failed:", e);
    return [];
  }
}

export function buildEquitySeries(snaps) {
  const rows = snaps.map((s) => {
    const dateNY = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date(s.json?.as_of_utc || 0)); // <-- your snapshots are "prior NY close"
    const accounts = s.json?.payload?.accounts || {};
    const acctKey = Object.keys(accounts).find(k => k !== "All");
    const netliq = Number(accounts[acctKey]?.NetLiquidation?.value ?? 0);
    return { date: dateNY, equity: netliq };
  }).filter(d => d.equity > 0);

  // dedupe by trading day (last snapshot for a date wins)
  const byDate = new Map();
  for (const r of rows) byDate.set(r.date, r);
  return Array.from(byDate.values()).sort((a,b)=>a.date.localeCompare(b.date));
}

// --- helpers (put these just above computePerformance) ---
const mean = (arr) => arr.reduce((a,b)=>a+b,0) / (arr.length || 1);
const std = (arr) => {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
};

/** series: [{date:"YYYY-MM-DD", equity:Number}] */
export function computePerformance(series) {
  if (!series || series.length === 0) {
    return { series: [], returns: [], vami: [], drawdown: [], stats: {} };
  }

  // ascending by date
  const s = [...series].sort((a,b) => a.date.localeCompare(b.date));

  // --- daily returns ---
  const returns = [];
  for (let i = 0; i < s.length; i++) {
    if (i === 0) { returns.push({ date: s[i].date, ret: 0 }); continue; }
    const r = (s[i].equity / s[i-1].equity) - 1;
    returns.push({ date: s[i].date, ret: r });
  }

  // --- VAMI (iterative, start 1000) ---
  const vami = [];
  for (let i = 0; i < s.length; i++) {
    if (i === 0) { vami.push({ date: s[i].date, v: 1000 }); continue; }
    const prev = vami[i-1].v;
    vami.push({ date: s[i].date, v: prev * (1 + returns[i].ret) });
  }

  // --- Drawdown from running peak ---
  const drawdown = [];
  let peak = vami[0].v;
  let maxDD = { dd: 0, date: s[0].date };
  for (let i = 0; i < vami.length; i++) {
    peak = Math.max(peak, vami[i].v);
    const dd = vami[i].v / peak - 1;
    drawdown.push({ date: vami[i].date, dd });
    if (dd < maxDD.dd) maxDD = { dd, date: vami[i].date };
  }

  // --- Stats ---
  const rets = returns.slice(1).map(r => r.ret); // skip first 0
  const n = rets.length;
  const mean = (arr) => arr.reduce((a,b)=>a+b,0) / (arr.length || 1);
  const std  = (arr) => { const m = mean(arr); return Math.sqrt(mean(arr.map(x => (x-m)**2))); };

  const avg = mean(rets);
  const volAnn = std(rets) * Math.sqrt(252);
  const retAnn = n > 0 ? (s[s.length-1].equity / s[0].equity) ** (252 / n) - 1 : 0;
  const sharpe = volAnn > 0 ? (avg * 252) / volAnn : 0;

  // YTD vs last obs of previous year (if present)
  const last = s[s.length-1].equity;
  const thisYear = new Date().getFullYear();
  let ytd = null;
  const firstIdxThisYear = s.findIndex(d => new Date(d.date).getFullYear() === thisYear);
  if (firstIdxThisYear >= 0) {
    const base = firstIdxThisYear > 0 ? s[firstIdxThisYear - 1].equity : s[0].equity;
    ytd = last / base - 1;
  }

  const stats = {
    since_inception: last / s[0].equity - 1,
    annual_return: retAnn,
    annual_vol: volAnn,
    sharpe,
    max_drawdown: maxDD.dd,
    ytd,
    days: n
  };

  return { series: s, returns, vami, drawdown, stats };
}