// src/contract.js
import { JsonRpcProvider, Contract } from "ethers";

const RPC = import.meta.env.VITE_RPC_URL;
const ADDRESS = import.meta.env.VITE_REGISTRY_ADDR;

const ABI = [
  {
    inputs: [],
    name: "getSnapshotCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
    name: "getSnapshot",
    outputs: [
      { internalType: "string",  name: "cid",        type: "string"  },
      { internalType: "bytes32", name: "sha256File", type: "bytes32" },
      { internalType: "uint256", name: "timestamp",  type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getLatest",
    outputs: [
      { internalType: "string",  name: "cid",        type: "string"  },
      { internalType: "bytes32", name: "sha256File", type: "bytes32" },
      { internalType: "uint256", name: "timestamp",  type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
];

const provider = new JsonRpcProvider(RPC);
const contract = new Contract(ADDRESS, ABI, provider);

// Latest snapshot (cid, sha256File, timestamp-ms)
export async function getLatestOnChain() {
  const count = await contract.getSnapshotCount();
  if (count === 0n) return { cid: null, sha256File: null, timestamp: null };
  const { cid, sha256File, timestamp } = await contract.getLatest();
  return {
    cid,
    sha256File: String(sha256File).toLowerCase(), // bytes32 -> 0x… string
    timestamp: Number(timestamp) * 1000           // ms for Date()
  };
}

// Read by index
export async function getSnapshotByIndex(index) {
  const { cid, sha256File, timestamp } = await contract.getSnapshot(BigInt(index));
  return {
    cid,
    sha256File: String(sha256File).toLowerCase(),
    timestamp: Number(timestamp) * 1000
  };
}

// Snapshot count
export async function getSnapshotCount() {
  const n = await contract.getSnapshotCount();
  return Number(n);
}