(() => {
  const config = window.WARRANTY_CONTRACT_CONFIG || {
    address: "",
    rpcUrl: "http://127.0.0.1:7545",
    abi: [],
  };

  let provider = null;
  let signer = null;
  let contract = null;
  let connectionMode = null; // "ganache" | "metamask"
  let ganacheAccounts = [];
  let currentManufacturer = "";

  // DOM Elements
  const rpcUrlInput = document.getElementById("rpcUrlInput");
  const contractAddressInput = document.getElementById("contractAddressInput");
  const connectGanacheBtn = document.getElementById("connectGanacheBtn");
  const connectMetaMaskBtn = document.getElementById("connectMetaMaskBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const ganacheAccountRow = document.getElementById("ganacheAccountRow");
  const ganacheAccountSelect = document.getElementById("ganacheAccountSelect");
  const connectionBadge = document.getElementById("connectionBadge");

  const connectedAccountEl = document.getElementById("connectedAccount");
  const accountBalanceEl = document.getElementById("accountBalance");
  const networkInfoEl = document.getElementById("networkInfo");
  const manufacturerAddressEl = document.getElementById("manufacturerAddress");
  const accountRoleEl = document.getElementById("accountRole");
  const productCountEl = document.getElementById("productCount");

  const txStatusBox = document.getElementById("txStatusBox");
  const txStatusTitle = document.getElementById("txStatusTitle");
  const txStatusBadge = document.getElementById("txStatusBadge");
  const txStatusMessage = document.getElementById("txStatusMessage");

  const registerForm = document.getElementById("registerForm");
  const regProductId = document.getElementById("regProductId");
  const regOwner = document.getElementById("regOwner");
  const regExpiration = document.getElementById("regExpiration");

  const transferForm = document.getElementById("transferForm");
  const transferProductId = document.getElementById("transferProductId");
  const transferNewOwner = document.getElementById("transferNewOwner");

  const lookupForm = document.getElementById("lookupForm");
  const lookupProductId = document.getElementById("lookupProductId");
  const lookupResult = document.getElementById("lookupResult");

  const productsTableBody = document.getElementById("productsTableBody");
  const eventsList = document.getElementById("eventsList");

  // Initialize defaults
  rpcUrlInput.value = config.rpcUrl || "http://127.0.0.1:7545";
  contractAddressInput.value = config.address || "";
  setDefaultExpiration();

  function setDefaultExpiration() {
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const localIso = new Date(
      oneYearFromNow.getTime() - oneYearFromNow.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);
    regExpiration.value = localIso;
  }

  function formatTimestamp(ts) {
    const num = Number(ts);
    if (!num) return "-";
    return new Date(num * 1000).toLocaleString();
  }

  function extractErrorMessage(err) {
    if (!err) return "Unknown error";
    if (err.reason) return err.reason;
    if (err.info && err.info.error && err.info.error.message) {
      return err.info.error.message;
    }
    if (err.shortMessage) return err.shortMessage;
    return err.message || String(err);
  }

  function showTxStatus(state, title, message) {
    txStatusBox.classList.remove("hidden", "tx-pending", "tx-success", "tx-error");
    txStatusBadge.classList.remove("badge-pending", "badge-success", "badge-error");

    if (state === "pending") {
      txStatusBox.classList.add("tx-pending");
      txStatusBadge.classList.add("badge-pending");
      txStatusBadge.textContent = "Pending";
    } else if (state === "success") {
      txStatusBox.classList.add("tx-success");
      txStatusBadge.classList.add("badge-success");
      txStatusBadge.textContent = "Confirmed";
    } else {
      txStatusBox.classList.add("tx-error");
      txStatusBadge.classList.add("badge-error");
      txStatusBadge.textContent = "Rejected / Error";
    }

    txStatusTitle.textContent = title;
    txStatusMessage.textContent = message;
  }

  async function initContract() {
    const address = contractAddressInput.value.trim();
    if (!ethers.isAddress(address)) {
      throw new Error("Please enter a valid deployed contract address.");
    }
    const code = await provider.getCode(address);
    if (!code || code === "0x") {
      throw new Error(
        `No contract code found at ${address} on the connected network. Deploy the contract first.`
      );
    }
    contract = new ethers.Contract(address, config.abi, signer);
  }

  async function connectGanache() {
    try {
      const rpcUrl = rpcUrlInput.value.trim();
      provider = new ethers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        throw new Error("No unlocked accounts found on Ganache.");
      }

      connectionMode = "ganache";
      ganacheAccounts = accounts;

      const ganacheAddressList = document.getElementById("ganacheAddressList");
      const regOwnerQuickPick = document.getElementById("regOwnerQuickPick");
      const transferOwnerQuickPick = document.getElementById("transferOwnerQuickPick");

      ganacheAccountSelect.innerHTML = "";
      const suggestedAccounts = [];

      for (let i = 0; i < accounts.length; i++) {
        const addr = await accounts[i].getAddress();
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = `Account ${i}: ${addr}`;
        ganacheAccountSelect.appendChild(opt);
        suggestedAccounts.push({ label: `Account ${i}`, address: addr });
      }

      if (window.ethereum) {
        try {
          const mmAccounts = await window.ethereum.request({ method: "eth_accounts" });
          for (const mmAddr of mmAccounts) {
            if (!suggestedAccounts.some((a) => a.address.toLowerCase() === mmAddr.toLowerCase())) {
              suggestedAccounts.push({ label: "MetaMask", address: mmAddr });
            }
          }
        } catch {
          // Ignore if MetaMask is locked or unavailable
        }
      }

      if (ganacheAddressList) ganacheAddressList.innerHTML = "";
      [regOwnerQuickPick, transferOwnerQuickPick].forEach((sel) => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Quick-pick an account --</option>';
      });

      for (const item of suggestedAccounts) {
        if (ganacheAddressList) {
          const dlOpt = document.createElement("option");
          dlOpt.value = item.address;
          dlOpt.label = item.label;
          ganacheAddressList.appendChild(dlOpt);
        }
        [regOwnerQuickPick, transferOwnerQuickPick].forEach((sel) => {
          if (!sel) return;
          const sOpt = document.createElement("option");
          sOpt.value = item.address;
          sOpt.textContent = `${item.label}: ${item.address}`;
          sel.appendChild(sOpt);
        });
      }

      if (regOwnerQuickPick && !regOwnerQuickPick.dataset.bound) {
        regOwnerQuickPick.dataset.bound = "1";
        regOwnerQuickPick.addEventListener("change", () => {
          if (regOwnerQuickPick.value) regOwner.value = regOwnerQuickPick.value;
        });
      }
      if (transferOwnerQuickPick && !transferOwnerQuickPick.dataset.bound) {
        transferOwnerQuickPick.dataset.bound = "1";
        transferOwnerQuickPick.addEventListener("change", () => {
          if (transferOwnerQuickPick.value) transferNewOwner.value = transferOwnerQuickPick.value;
        });
      }
      ganacheAccountRow.classList.remove("hidden");

      signer = accounts[0];
      if (!regOwner.value && accounts.length > 1) {
        regOwner.value = await accounts[1].getAddress();
      }
      if (!transferNewOwner.value && accounts.length > 2) {
        transferNewOwner.value = await accounts[2].getAddress();
      }

      connectionBadge.textContent = `Ganache (Chain ${network.chainId})`;
      connectionBadge.className = "badge badge-online";
      refreshBtn.disabled = false;

      if (contractAddressInput.value.trim()) {
        await initContract();
      } else {
        contract = null;
      }

      await refreshUI();
      showTxStatus("success", "Connected to Ganache", `Connected to ${rpcUrl} (Chain ID: ${network.chainId}).`);
    } catch (err) {
      showTxStatus("error", "Connection Failed", extractErrorMessage(err));
    }
  }

  async function connectMetaMask() {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed in this browser.");
      }
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const targetChainId = Number(config.chainId || 1337);
      let network = await provider.getNetwork();
      if (Number(network.chainId) !== targetChainId) {
        const hexChainId = "0x" + targetChainId.toString(16);
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hexChainId }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: hexChainId,
                  chainName: "Ganache Local (7545)",
                  rpcUrls: [rpcUrlInput.value.trim() || "http://127.0.0.1:7545"],
                  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                },
              ],
            });
          } else {
            throw switchErr;
          }
        }
        provider = new ethers.BrowserProvider(window.ethereum);
        network = await provider.getNetwork();
      }

      signer = await provider.getSigner();

      connectionMode = "metamask";
      ganacheAccountRow.classList.add("hidden");

      connectionBadge.textContent = `MetaMask (Chain ${network.chainId})`;
      connectionBadge.className = "badge badge-online";
      refreshBtn.disabled = false;

      if (contractAddressInput.value.trim()) {
        await initContract();
      } else {
        contract = null;
      }

      await refreshUI();
      showTxStatus("success", "Connected to MetaMask", `Connected on Chain ID ${network.chainId}.`);
    } catch (err) {
      showTxStatus("error", "MetaMask Connection Failed", extractErrorMessage(err));
    }
  }

  async function refreshUI() {
    if (!provider || !signer) return;

    const accountAddr = await signer.getAddress();
    const balance = await provider.getBalance(accountAddr);
    const network = await provider.getNetwork();

    connectedAccountEl.textContent = accountAddr;
    accountBalanceEl.textContent = `${Number(ethers.formatEther(balance)).toFixed(4)} ETH`;
    networkInfoEl.textContent = `Chain ID ${network.chainId}`;

    if (!contract && contractAddressInput.value.trim()) {
      await initContract();
    }

    if (!contract) {
      manufacturerAddressEl.textContent = "Contract not loaded";
      accountRoleEl.textContent = "-";
      productCountEl.textContent = "0";
      return;
    }

    currentManufacturer = await contract.manufacturer();
    manufacturerAddressEl.textContent = currentManufacturer;

    const isMfg = accountAddr.toLowerCase() === currentManufacturer.toLowerCase();
    accountRoleEl.innerHTML = isMfg
      ? '<span class="badge badge-active">Manufacturer (Admin)</span>'
      : '<span class="badge badge-pending">User / Product Owner</span>';

    const count = await contract.getProductCount();
    productCountEl.textContent = count.toString();

    await loadProductsTable();
    await loadEvents();
  }

  async function loadProductsTable() {
    if (!contract) return;
    const ids = await contract.getAllProductIds();
    if (ids.length === 0) {
      productsTableBody.innerHTML =
        '<tr><td colspan="5" class="empty-cell">No products registered yet.</td></tr>';
      return;
    }

    const rows = [];
    for (const id of ids) {
      const w = await contract.getWarranty(id);
      const statusBadge = w.isActive
        ? '<span class="badge badge-active">ACTIVE</span>'
        : '<span class="badge badge-expired">EXPIRED</span>';

      rows.push(`
        <tr>
          <td><strong>${escapeHtml(w.id)}</strong></td>
          <td class="mono">${escapeHtml(w.currentOwner)}</td>
          <td>${escapeHtml(formatTimestamp(w.registeredAt))}</td>
          <td>${escapeHtml(formatTimestamp(w.expirationTime))}</td>
          <td>${statusBadge}</td>
        </tr>
      `);
    }
    productsTableBody.innerHTML = rows.join("");
  }

  async function loadEvents() {
    if (!contract) return;
    const regEvents = await contract.queryFilter(contract.filters.ProductRegistered(), 0, "latest");
    const transferEvents = await contract.queryFilter(contract.filters.OwnershipTransferred(), 0, "latest");

    const combined = [
      ...regEvents.map((e) => ({
        blockNumber: e.blockNumber,
        logIndex: e.index,
        type: "ProductRegistered",
        text: `Registered <strong>${escapeHtml(e.args.productId)}</strong> &rarr; Owner <span class="mono">${escapeHtml(e.args.owner)}</span> (Expires: ${escapeHtml(formatTimestamp(e.args.expirationTime))})`,
      })),
      ...transferEvents.map((e) => ({
        blockNumber: e.blockNumber,
        logIndex: e.index,
        type: "OwnershipTransferred",
        text: `Transferred <strong>${escapeHtml(e.args.productId)}</strong>: <span class="mono">${escapeHtml(e.args.previousOwner)}</span> &rarr; <span class="mono">${escapeHtml(e.args.newOwner)}</span>`,
      })),
    ].sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);

    if (combined.length === 0) {
      eventsList.innerHTML = '<li class="empty-cell">No contract events emitted yet.</li>';
      return;
    }

    eventsList.innerHTML = combined
      .map(
        (ev) =>
          `<li><span class="badge ${ev.type === "ProductRegistered" ? "badge-active" : "badge-pending"}">${ev.type}</span> (Block #${ev.blockNumber}) &mdash; ${ev.text}</li>`
      )
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Event Handlers
  connectGanacheBtn.addEventListener("click", connectGanache);
  connectMetaMaskBtn.addEventListener("click", connectMetaMask);
  refreshBtn.addEventListener("click", async () => {
    try {
      await initContract();
      await refreshUI();
    } catch (err) {
      showTxStatus("error", "Refresh Failed", extractErrorMessage(err));
    }
  });

  ganacheAccountSelect.addEventListener("change", async () => {
    if (connectionMode !== "ganache") return;
    const idx = Number(ganacheAccountSelect.value);
    signer = ganacheAccounts[idx];
    if (contract) {
      contract = contract.connect(signer);
    }
    await refreshUI();
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!contract) {
      showTxStatus("error", "Not Ready", "Connect to Ganache/MetaMask and load a deployed contract first.");
      return;
    }
    const productId = regProductId.value.trim();
    const owner = regOwner.value.trim();
    const expDate = new Date(regExpiration.value);
    const expTimestamp = Math.floor(expDate.getTime() / 1000);

    try {
      showTxStatus("pending", "Registering Product...", `Submitting registerProduct("${productId}")...`);
      const tx = await contract.registerProduct(productId, owner, expTimestamp);
      const receipt = await tx.wait();
      showTxStatus(
        "success",
        "Product Registered",
        `Product "${productId}" registered for ${owner}. Tx Hash: ${receipt.hash}`
      );
      await refreshUI();
    } catch (err) {
      showTxStatus("error", "Registration Rejected", extractErrorMessage(err));
    }
  });

  transferForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!contract) {
      showTxStatus("error", "Not Ready", "Connect to Ganache/MetaMask and load a deployed contract first.");
      return;
    }
    const productId = transferProductId.value.trim();
    const newOwner = transferNewOwner.value.trim();

    try {
      showTxStatus("pending", "Transferring Ownership...", `Submitting transferOwnership("${productId}", ${newOwner})...`);
      const tx = await contract.transferOwnership(productId, newOwner);
      const receipt = await tx.wait();
      showTxStatus(
        "success",
        "Ownership Transferred",
        `Product "${productId}" transferred to ${newOwner}. Tx Hash: ${receipt.hash}`
      );
      await refreshUI();
    } catch (err) {
      showTxStatus("error", "Transfer Rejected", extractErrorMessage(err));
    }
  });

  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!contract) {
      showTxStatus("error", "Not Ready", "Connect to Ganache/MetaMask and load a deployed contract first.");
      return;
    }
    const productId = lookupProductId.value.trim();
    try {
      const w = await contract.getWarranty(productId);
      lookupResult.classList.remove("hidden");
      if (!w.exists) {
        lookupResult.innerHTML = `<strong>${escapeHtml(productId)}</strong>: <span class="badge badge-expired">NOT REGISTERED</span>`;
        return;
      }
      const badge = w.isActive
        ? '<span class="badge badge-active">ACTIVE</span>'
        : '<span class="badge badge-expired">EXPIRED</span>';
      lookupResult.innerHTML = `
        <div><strong>Product ID:</strong> ${escapeHtml(w.id)} ${badge}</div>
        <div><strong>Current Owner:</strong> <span class="mono">${escapeHtml(w.currentOwner)}</span></div>
        <div><strong>Manufacturer:</strong> <span class="mono">${escapeHtml(w.manufacturerAddr)}</span></div>
        <div><strong>Registered At:</strong> ${escapeHtml(formatTimestamp(w.registeredAt))}</div>
        <div><strong>Expires At:</strong> ${escapeHtml(formatTimestamp(w.expirationTime))}</div>
      `;
    } catch (err) {
      showTxStatus("error", "Lookup Failed", extractErrorMessage(err));
    }
  });

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async () => {
      if (connectionMode === "metamask") {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        if (contract) contract = contract.connect(signer);
        await refreshUI();
      }
    });
    window.ethereum.on("chainChanged", () => {
      if (connectionMode === "metamask") window.location.reload();
    });
  }
})();
