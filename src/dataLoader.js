// src/dataLoader.js
// Fetch snapshot by file CID *or* "rootCID/filename" path and verify SHA-256.
// If expectedHex (on-chain bytes32) is provided, verify against that first.

async function fetchWithTimeout(url, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: ctl.signal });
  } finally { clearTimeout(t); }
}

function toHex(u8) {
  return Array.from(u8).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Deterministic stringify: sort object keys, no spaces, stable arrays.
function stableStringify(x) {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const keys = Object.keys(x).sort();
  const parts = keys.map(k => JSON.stringify(k) + ":" + stableStringify(x[k]));
  return "{" + parts.join(",") + "}";
}

/**
 * pointer:
 *  - "bafy...FILECID"                          (file CID)
 *  - "bafy...ROOTCID/snapshot.canonical.json"  (root CID + filename path)
 * expectedHex (optional): bytes32 like "0xabc..." from chain
 */
export async function fetchAndVerifyByCID(pointer, expectedHex) {
  if (!pointer) throw new Error("No CID provided");

  const isPath = pointer.includes("/");
  const gateways = isPath
    ? [
        `https://w3s.link/ipfs/${pointer}`,
        `https://nftstorage.link/ipfs/${pointer}`,
        `https://dweb.link/ipfs/${pointer}`,
      ]
    : [
        `https://${pointer}.ipfs.w3s.link`,
        `https://${pointer}.ipfs.nftstorage.link`,
        `https://${pointer}.ipfs.dweb.link`,
      ];

  const expected = (expectedHex || "").toLowerCase().replace(/^0x/, "");

  let lastErr;
  for (const url of gateways) {
    try {
      const res = await fetchWithTimeout(url, 15000);
      if (!res.ok) { lastErr = new Error(`${url} -> ${res.status}`); continue; }

      const bytes = new Uint8Array(await res.arrayBuffer());
      const text  = new TextDecoder().decode(bytes);

      if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
        lastErr = new Error(`${url} -> HTML response (not JSON)`); continue;
      }

      const json = JSON.parse(text);

      // Hash #1: file-bytes (exact bytes fetched)
      const digest1 = await crypto.subtle.digest("SHA-256", bytes);
      const fileHash = toHex(new Uint8Array(digest1)).toLowerCase();

      // Hash #2: canonical JSON EXCLUDING 'sha256' (legacy support)
      const clone = JSON.parse(text);
      delete clone.sha256;
      const canonStr = stableStringify(clone);
      const digest2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonStr));
      const canonicalHash = toHex(new Uint8Array(digest2)).toLowerCase();

      const inFile = (json.sha256 || "").toLowerCase();

      let ok = false;
      let mode = "";
      if (expected) {                      // prefer on-chain
        ok = fileHash === expected;
        mode = "on-chain-file-bytes";
      } else if (inFile && inFile === fileHash) {
        ok = true; mode = "file-bytes";
      } else if (inFile && inFile === canonicalHash) {
        ok = true; mode = "canonical-minus-sha256";
      }

      return {
        ok,
        mode,                           // "on-chain-file-bytes" | "file-bytes" | "canonical-minus-sha256" | ""
        sha256_onchain: expectedHex || null,
        sha256_expected: inFile || null,
        sha256_file: fileHash,
        sha256_canonical: canonicalHash,
        json,
        url,
      };

    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All IPFS gateways failed");
}

// --- New: Fetch snapshots directly from local API (SQLite) ---
export async function fetchFromAPI() {
  try {
    const res = await fetch("http://127.0.0.1:8000/snapshots");
    if (!res.ok) throw new Error(`API fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchFromAPI error:", err);
    return [];
  }
}