const assert = require("assert");
const ganache = require("ganache");
const { ethers } = require("ethers");
const { compileContract } = require("./compile");

async function expectRevert(txPromise, expectedReason) {
  let failed = false;
  try {
    const tx = await txPromise;
    await tx.wait();
  } catch (err) {
    failed = true;
    const message =
      err.reason ||
      (err.info && err.info.error && err.info.error.message) ||
      err.shortMessage ||
      err.message ||
      "";
    if (expectedReason && !message.includes(expectedReason)) {
      throw new Error(
        `Expected revert reason "${expectedReason}", but got: "${message}"`
      );
    }
  }
  assert.strictEqual(failed, true, `Expected transaction to revert (${expectedReason})`);
}

async function runTests() {
  console.log("=== ProductWarrantyRegistry Automated Test Suite ===\n");

  const artifact = compileContract();

  // Start an in-memory Ganache instance (EIP-1193 provider)
  const ganacheProvider = ganache.provider({
    logging: { quiet: true },
    wallet: { totalAccounts: 5, defaultBalance: 100 },
  });

  const provider = new ethers.BrowserProvider(ganacheProvider);
  const signers = await provider.listAccounts();
  const manufacturer = signers[0];
  const owner1 = signers[1];
  const owner2 = signers[2];
  const stranger = signers[3];

  const manufacturerAddr = await manufacturer.getAddress();
  const owner1Addr = await owner1.getAddress();
  const owner2Addr = await owner2.getAddress();
  const strangerAddr = await stranger.getAddress();

  console.log("Accounts:");
  console.log("  Manufacturer (Account 0):", manufacturerAddr);
  console.log("  Owner 1      (Account 1):", owner1Addr);
  console.log("  Owner 2      (Account 2):", owner2Addr);
  console.log("  Stranger     (Account 3):", strangerAddr);
  console.log("");

  // Deploy contract
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, manufacturer);
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  const contractAddress = await registry.getAddress();
  console.log("[PASS] Deployed ProductWarrantyRegistry at:", contractAddress);

  assert.strictEqual(await registry.manufacturer(), manufacturerAddr);
  console.log("[PASS] Manufacturer set to deployer (Account 0)");

  // Test 1: Register product successfully as Manufacturer
  const latestBlock = await provider.getBlock("latest");
  const oneYearLater = latestBlock.timestamp + 365 * 24 * 60 * 60;

  const regTx = await registry
    .connect(manufacturer)
    .registerProduct("LAPTOP-2026-001", owner1Addr, oneYearLater);
  const regReceipt = await regTx.wait();

  const regEvent = regReceipt.logs
    .map((log) => {
      try {
        return registry.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "ProductRegistered");

  assert.ok(regEvent, "ProductRegistered event should be emitted");
  assert.strictEqual(regEvent.args.productId, "LAPTOP-2026-001");
  assert.strictEqual(regEvent.args.owner, owner1Addr);

  const warranty1 = await registry.getWarranty("LAPTOP-2026-001");
  assert.strictEqual(warranty1.currentOwner, owner1Addr);
  assert.strictEqual(warranty1.isActive, true);
  assert.strictEqual(warranty1.exists, true);
  console.log("[PASS] Manufacturer registered LAPTOP-2026-001 for Owner 1 (ProductRegistered event verified)");

  // Test 2: Non-manufacturer cannot register a product
  await expectRevert(
    registry.connect(owner1).registerProduct("FAKE-001", owner1Addr, oneYearLater),
    "Only manufacturer can perform this action"
  );
  console.log("[PASS] Rejected unauthorized registration by non-manufacturer (Owner 1)");

  // Test 3: Duplicate product ID is rejected
  await expectRevert(
    registry.connect(manufacturer).registerProduct("LAPTOP-2026-001", owner2Addr, oneYearLater),
    "Product ID already registered"
  );
  console.log("[PASS] Rejected duplicate product ID registration");

  // Test 4: Past expiration time is rejected
  await expectRevert(
    registry.connect(manufacturer).registerProduct("OLD-001", owner1Addr, latestBlock.timestamp - 10),
    "Expiration time must be in the future"
  );
  console.log("[PASS] Rejected registration with past expiration time");

  // Test 5: Current owner (Owner 1) transfers ownership to Owner 2
  const transferTx = await registry
    .connect(owner1)
    .transferOwnership("LAPTOP-2026-001", owner2Addr);
  const transferReceipt = await transferTx.wait();

  const transferEvent = transferReceipt.logs
    .map((log) => {
      try {
        return registry.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === "OwnershipTransferred");

  assert.ok(transferEvent, "OwnershipTransferred event should be emitted");
  assert.strictEqual(transferEvent.args.previousOwner, owner1Addr);
  assert.strictEqual(transferEvent.args.newOwner, owner2Addr);

  const warrantyAfter = await registry.getWarranty("LAPTOP-2026-001");
  assert.strictEqual(warrantyAfter.currentOwner, owner2Addr);
  console.log("[PASS] Owner 1 transferred LAPTOP-2026-001 to Owner 2 (OwnershipTransferred event verified)");

  // Test 6: Former owner (Owner 1) cannot transfer ownership anymore
  await expectRevert(
    registry.connect(owner1).transferOwnership("LAPTOP-2026-001", strangerAddr),
    "Only the current owner can transfer ownership"
  );
  console.log("[PASS] Rejected transfer attempt from former owner (Owner 1)");

  // Test 7: Manufacturer cannot transfer ownership once owned by Owner 2
  await expectRevert(
    registry.connect(manufacturer).transferOwnership("LAPTOP-2026-001", strangerAddr),
    "Only the current owner can transfer ownership"
  );
  console.log("[PASS] Rejected transfer attempt from manufacturer (not current owner)");

  // Test 8: Warranty expiration check
  const currentBlock = await provider.getBlock("latest");
  const shortExpiry = currentBlock.timestamp + 60;
  await (
    await registry.connect(manufacturer).registerProduct("PHONE-2026-002", owner1Addr, shortExpiry)
  ).wait();

  assert.strictEqual(await registry.isWarrantyActive("PHONE-2026-002"), true);
  console.log("[PASS] PHONE-2026-002 warranty is active before expiration");

  // Advance Ganache blockchain time by 120 seconds
  await ganacheProvider.request({ method: "evm_increaseTime", params: [120] });
  await ganacheProvider.request({ method: "evm_mine", params: [] });

  assert.strictEqual(await registry.isWarrantyActive("PHONE-2026-002"), false);
  const expiredWarranty = await registry.getWarranty("PHONE-2026-002");
  assert.strictEqual(expiredWarranty.isActive, false);
  console.log("[PASS] PHONE-2026-002 warranty is inactive after expiration time");

  // Test 9: Product list and count
  const count = await registry.getProductCount();
  const ids = await registry.getAllProductIds();
  assert.strictEqual(Number(count), 2);
  assert.deepStrictEqual(Array.from(ids), ["LAPTOP-2026-001", "PHONE-2026-002"]);
  console.log("[PASS] Product count (2) and product ID list verified");

  await ganacheProvider.disconnect();
  console.log("\n=== All 9 tests passed successfully! ===");
}

runTests().catch((err) => {
  console.error("\n[FAIL]", err);
  process.exit(1);
});
