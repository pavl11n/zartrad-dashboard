import { fetchLatestCID } from './contract.js';

export async function loadSnapshotData() {
  const cid = await fetchLatestCID(); // fetch latest CID from contract
  const url = `https://w3s.link/ipfs/${cid}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot JSON: ${response.status}`);
  }

  return await response.json();
}