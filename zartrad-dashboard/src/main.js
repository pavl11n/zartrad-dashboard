import './style.css';
import { loadSnapshotData } from './dataLoader.js';
import { fetchContractMessage } from './contract.js'; // stubbed

async function renderSnapshot() {
  let data;
  try {
    data = await loadSnapshotData();
  } catch (err) {
    console.error("Failed to load snapshot data:", err);
    return;
  }

  const app = document.querySelector('#app');

  // Load account info from data
  const account = data["U21262439"] || {};
  const pnl = data["All"] || {};
  const positions = data["Positions"] || [];

  app.innerHTML = `
    <h1>Zartrad Dashboard</h1>
    <section>
      <h2>Snapshot Source</h2>
      <p><b>IPFS CID:</b> bafybeihxgmwyofkso7h2fos6wpq5ncg4jkcuuydqmky6sjbvbek74svqb4</p>
      <p><a href="https://w3s.link/ipfs/bafybeihxgmwyofkso7h2fos6wpq5ncg4jkcuuydqmky6sjbvbek74svqb4/snapshot_2025-08-06_16-39-03.json" target="_blank">Open JSON Snapshot</a></p>
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