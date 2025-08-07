import { JsonRpcProvider, Contract } from "ethers";

const contractAddress = "0xfB3B6b718F9D6793719AEa05Bcd2aAd9A29F8677";

const abi = [
  {
    "inputs": [{ "internalType": "string", "name": "_cid", "type": "string" }],
    "name": "uploadCID",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLatestCID",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export async function fetchLatestCID() {
  const provider = new JsonRpcProvider("https://rpc-amoy.polygon.technology");
  const contract = new Contract(contractAddress, abi, provider);
  return await contract.getLatestCID();
}