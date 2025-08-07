export async function loadSnapshotData() {
  const CID = "bafybeihxgmwyofkso7h2fos6wpq5ncg4jkcuuydqmky6sjbvbek74svqb4";
  const FILENAME = "snapshot_2025-08-06_16-39-03.json";
  const url = `https://w3s.link/ipfs/${CID}/${FILENAME}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}