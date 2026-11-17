const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT_DIR = path.resolve(__dirname, "..");
const CONTRACT_PATH = path.join(ROOT_DIR, "contracts", "ProductWarrantyRegistry.sol");
const BUILD_DIR = path.join(ROOT_DIR, "build");

function compileContract() {
  const source = fs.readFileSync(CONTRACT_PATH, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "ProductWarrantyRegistry.sol": {
        content: source,
      },
    },
    settings: {
      evmVersion: "london",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((err) => err.severity === "error");
    output.errors.forEach((err) => console.log(err.formattedMessage));
    if (errors.length > 0) {
      throw new Error("Solidity compilation failed.");
    }
  }

  const compiled = output.contracts["ProductWarrantyRegistry.sol"]["ProductWarrantyRegistry"];
  const artifact = {
    contractName: "ProductWarrantyRegistry",
    abi: compiled.abi,
    bytecode: "0x" + compiled.evm.bytecode.object,
  };

  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  const artifactPath = path.join(BUILD_DIR, "ProductWarrantyRegistry.json");
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  console.log("Compiled ProductWarrantyRegistry successfully.");
  console.log("Artifact saved to:", artifactPath);
  return artifact;
}

if (require.main === module) {
  compileContract();
}

module.exports = { compileContract };
