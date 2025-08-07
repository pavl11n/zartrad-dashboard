import './style.css';
import { JsonRpcProvider, Contract } from "ethers";

async function renderSnapshot() {
  const app = document.querySelector('#app');
  app.innerHTML = "<h1>Zartrad Dashboard</h1><p>Loading...</p>";

  let cid, timestamp, data;

  try {
    const provider = new JsonRpcProvider("https://rpc-amoy.polygon.technology");
    const contract = new Contract(
      "0xfB3B6b718F9D6793719AEa05Bcd2aAd9A29F8677",
      [
        {
          "inputs": [],
          "name": "getLatestCID",
          "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getSnapshotCount",
          "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
          "name": "getSnapshot",
          "outputs": [
            { "internalType": "string", "name": "cid", "type": "string" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      provider
    );

    const count = await contract.getSnapshotCount();
    const index = Number(count) - 1;
    const latest = await contract.getSnapshot(index);
    cid = latest.cid;
    timestamp = new Date(Number(latest.timestamp) * 1000).toLocaleString();

    const res = await fetch(`https://w3s.link/ipfs/${cid}/snapshot_2025-08-06_16-39-03.json`);
    data = await res.json();

  } catch (err) {
    app.innerHTML = `<h1>Zartrad Dashboard</h1><p style="color:red;">Error: ${err.message}</p>`;
    console.error(err);
    return;
  }

  const account = data["U21262439"] || {};
  const pnl = data["All"] || {};
  const positions = data["Positions"] || [];

  app.innerHTML = `
    <h1>Zartrad Dashboard</h1>
    
    <section style="border: 2px solid #666; padding: 20px; margin-bottom: 20px;">
      <h2>Snapshot Source <span style="color:limegreen;">(Verified ✅)</span></h2>
      <p><b>IPFS CID (on-chain):</b> ${cid}</p>
      <p><b>Timestamp (on-chain):</b> ${timestamp}</p>
      <p>
        🔗 <a href="https://w3s.link/ipfs/${cid}/snapshot_2025-08-06_16-39-03.json" target="_blank">Open JSON Snapshot</a><br>
        🧠 <a href="https://amoy.polygonscan.com/address/0xfB3B6b718F9D6793719AEa05Bcd2aAd9A29F8677#readContract" target="_blank">View Smart Contract on Polygonscan</a>
      </p>
    </section>

    <section>
      <h2>Account</h2>
      <p><b>Buying Power:</b> ${account.BuyingPower}</p>
      <p><b>Net Liquidation:</b> ${account.NetLiquidation}</p>
      <p><b>Total Cash Value:</b> ${account.TotalCashValue}</p>
    </section>

    <section>
      <h2>PnL</h2>
      <p><b>Unrealized:</b> ${pnl.UnrealizedPnL}</p>
      <p><b>Realized:</b> ${pnl.RealizedPnL}</p>
    </section>

    <section>
      <h2>Positions</h2>
      ${positions.map(pos => `
        <div style="margin-bottom: 20px;">
          <h3>${pos.Instrument}</h3>
          <p><b>Symbol:</b> ${pos.Symbol}</p>
          <p><b>SecType:</b> ${pos.SecType}</p>
          <p><b>Position:</b> ${pos.Position}</p>
          <p><b>AvgPrice:</b> ${pos.AvgPrice}</p>
          <p><b>LastPrice:</b> ${pos.LastPrice}</p>
          <p><b>PctChange:</b> ${pos.PctChange}</p>
          <p><b>PnL $:</b> ${pos["PnL_$"]}</p>
        </div>
      `).join("")}
    </section>
  `;
}

renderSnapshot();