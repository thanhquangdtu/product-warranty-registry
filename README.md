# Product Warranty Registry

**Course:** DS 441 A - Blockchain: Theory & Practices  
**Student:** Lê Thành Quang  
**Student ID:** 29211120739  

## Overview

The **Product Warranty Registry** is a decentralized application (DApp) built on Ethereum/Solidity and deployed to a local **Ganache** blockchain. It tracks product warranties from initial registration by a manufacturer through ownership transfers between customers, enforcing all business rules and address-based permissions on-chain.

### Smart Contract Rules (`contracts/ProductWarrantyRegistry.sol`)
- **Manufacturer-only registration:** Only the deployer (`manufacturer`) can call `registerProduct(productId, owner, expirationTime)`.
- **Input & state validation:**
  - `productId` must be non-empty and not already registered.
  - `owner` and `newOwner` cannot be the zero address (`0x0`).
  - `expirationTime` must be in the future (`> block.timestamp`).
- **Owner-only transfer:** Only `currentOwner` can call `transferOwnership(productId, newOwner)`. Former owners, other users, and even the manufacturer (once transferred) are rejected by the contract.
- **Validity check:** `isWarrantyActive(productId)` and `getWarranty(productId)` compute active status on-chain using `block.timestamp <= expirationTime`.
- **Events:** Emits `ProductRegistered` and `OwnershipTransferred` for all state changes, which are displayed in the Web3 UI.

---

## Project Structure

```text
DS441_Individual_Mini_Projects/
├── contracts/
│   └── ProductWarrantyRegistry.sol   # Solidity smart contract
├── scripts/
│   ├── compile.js                    # Compiles contract with solc
│   ├── deploy.js                     # Deploys to local Ganache & updates frontend config
│   ├── serve.js                      # Serves the Web3 frontend on http://127.0.0.1:8080
│   ├── test.js                       # Automated Ganache test suite (9 test cases)
│   └── interact_ganache.py           # Optional Python web3.py demo script
├── frontend/
│   ├── index.html                    # Web3 DApp UI
│   ├── styles.css                    # Styling
│   ├── app.js                        # ethers.js v6 interaction & event listener
│   └── contract-config.js            # Auto-updated with deployed address & ABI
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js** (v18+ recommended; tested with v22.19.0) and **npm**
- **Ganache** (Ganache UI or `ganache` CLI) running locally
- **Web Browser** (Chrome/Edge/Firefox; MetaMask optional)
- **Python 3.10+** with `web3` (optional, only if running `scripts/interact_ganache.py`)

> **Security Note:** Use **Ganache test accounts and test Ether only**. Never use real funds or real private keys.

---

## Ganache Network Settings

| Setting | Value |
| --- | --- |
| **RPC URL** | `http://127.0.0.1:7545` |
| **Network / Chain ID** | `1337` (or `5777` depending on Ganache workspace) |
| **Currency Symbol** | `ETH` (test Ether) |

---

## Setup, Deployment & Run Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile & Run Automated Tests
Runs an in-memory Ganache instance and verifies all 9 contract rules and edge cases:
```bash
npm run compile
npm test
```

### 3. Deploy to Local Ganache (`http://127.0.0.1:7545`)
1. Start **Ganache** on `http://127.0.0.1:7545`.
2. Run the deployment script:
   ```bash
   npm run deploy
   ```
   This deploys `ProductWarrantyRegistry` using Ganache Account 0 (Manufacturer) and automatically writes the contract address and ABI to `build/deployment.json` and `frontend/contract-config.js`.

### 4. Launch the Web3 Frontend
Start the local Web3 frontend server:
```bash
npm start
```
Then open `http://127.0.0.1:8080` in your browser.

---

## Demonstration Workflow (Multi-Account)

1. **Connect Wallet:** Click **Connect to Ganache RPC** (or **Connect MetaMask**). The deployed contract address is pre-filled.
2. **Register a Product (Account 0 - Manufacturer):**
   - Select **Account 0** (Manufacturer).
   - Enter Product ID `LAPTOP-2026-001`, Initial Owner = **Account 1** address, and a future expiration date.
   - Click **Register Product** -> Transaction confirms, `ProductRegistered` event appears, and status shows **ACTIVE**.
3. **Transfer Ownership (Account 1 - Current Owner):**
   - Switch to **Account 1** in the Ganache account dropdown.
   - Transfer `LAPTOP-2026-001` to **Account 2** -> Transaction confirms, `OwnershipTransferred` event appears, and Current Owner updates to Account 2.
4. **Reject Unauthorized Transfer from Former Owner (Account 1):**
   - Stay on **Account 1** (now the *former* owner) and attempt to transfer `LAPTOP-2026-001` again.
   - The smart contract **reverts** with `"Only the current owner can transfer ownership"`, and the UI displays the rejection reason.
5. **Check Warranty Validity:**
   - Use Section 4 (**Check Product Warranty Validity**) or view the **Registered Products Registry** table to verify owner and **ACTIVE** / **EXPIRED** status.

---

## Test Results

Running `npm test` executes 9 automated tests against Ganache:
1. Contract deployment sets Account 0 as `manufacturer`.
2. Manufacturer successfully registers `LAPTOP-2026-001` for Owner 1 and emits `ProductRegistered`.
3. Non-manufacturer registration attempt is rejected (`Only manufacturer can perform this action`).
4. Duplicate product ID registration is rejected (`Product ID already registered`).
5. Past expiration timestamp registration is rejected (`Expiration time must be in the future`).
6. Current owner (Owner 1) transfers `LAPTOP-2026-001` to Owner 2 and emits `OwnershipTransferred`.
7. Former owner (Owner 1) transfer attempt is rejected (`Only the current owner can transfer ownership`).
8. Manufacturer transfer attempt (when not current owner) is rejected (`Only the current owner can transfer ownership`).
9. Warranty expiration is tracked accurately using Ganache EVM time advancement (`evm_increaseTime`), transitioning `isWarrantyActive` from `true` to `false`.

---

## Citations & Assistance

- **ethers.js v6** (`https://docs.ethers.org/v6/`) for Web3 provider, contract interaction, and event querying.
- **Solidity (`solc` 0.8.x)** and **Ganache** for smart contract compilation and local Ethereum testing.
- Course starter Python `web3.py` connection pattern provided in DS 441 A.
- AI coding assistant used for project scaffolding, smart contract/UI implementation, and debugging support.
