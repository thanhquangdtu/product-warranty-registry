import json
import time
from pathlib import Path
from web3 import Web3

RPC_URL = "http://127.0.0.1:7545"
DEPLOYMENT_FILE = Path(__file__).resolve().parent.parent / "build" / "deployment.json"

# Fallback values if build/deployment.json is not present
CONTRACT_ADDRESS = ""
ABI_JSON = "[]"

if DEPLOYMENT_FILE.exists():
    deployment = json.loads(DEPLOYMENT_FILE.read_text(encoding="utf-8"))
    CONTRACT_ADDRESS = deployment["address"]
    abi = deployment["abi"]
else:
    abi = json.loads(ABI_JSON)

w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 10}))
if not w3.is_connected():
    raise ConnectionError(
        f"Cannot connect to Ganache at {RPC_URL}. Check that Ganache is running and the URL is correct."
    )
if not Web3.is_address(CONTRACT_ADDRESS):
    raise ValueError("Paste a valid deployed contract address into CONTRACT_ADDRESS or run `npm run deploy`.")

address = Web3.to_checksum_address(CONTRACT_ADDRESS)
if not w3.eth.get_code(address):
    raise ValueError("No contract code at this address on the connected network.")

contract = w3.eth.contract(address=address, abi=abi)
accounts = w3.eth.accounts

print("Connected to Ganache and ProductWarrantyRegistry!")
print("Chain ID:", w3.eth.chain_id)
print("Contract:", address)
print("Available unlocked accounts:", accounts)

if len(accounts) < 3:
    raise RuntimeError("At least 3 Ganache accounts are required for this demo.")

manufacturer = accounts[0]
owner1 = accounts[1]
owner2 = accounts[2]
product_id = f"DEMO-PY-{int(time.time())}"
expiration_time = int(time.time()) + 365 * 24 * 60 * 60

# 1. Manufacturer registers product for Owner 1
print(f"\n1. Registering {product_id} for Owner 1 ({owner1})...")
tx_hash = contract.functions.registerProduct(product_id, owner1, expiration_time).transact(
    {"from": manufacturer}
)
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
print("   Success! Tx hash:", receipt.transactionHash.hex())
print("   Warranty active:", contract.functions.isWarrantyActive(product_id).call())

# 2. Owner 1 transfers ownership to Owner 2
print(f"\n2. Transferring {product_id} from Owner 1 to Owner 2 ({owner2})...")
tx_hash = contract.functions.transferOwnership(product_id, owner2).transact({"from": owner1})
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
print("   Success! Tx hash:", receipt.transactionHash.hex())
print("   Warranty details:", contract.functions.getWarranty(product_id).call())

# 3. Former owner (Owner 1) tries to transfer again -> rejected
print(f"\n3. Former owner ({owner1}) attempting unauthorized transfer...")
try:
    tx_hash = contract.functions.transferOwnership(product_id, manufacturer).transact({"from": owner1})
    w3.eth.wait_for_transaction_receipt(tx_hash)
    print("   ERROR: Transfer unexpectedly succeeded!")
except Exception as exc:
    print("   Rejected as expected:", exc)
