// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProductWarrantyRegistry
 * @author Le Thanh Quang (Student ID: 29211120739)
 * @notice DS 441 A - Blockchain: Theory & Practices (Individual Mini Project)
 * @dev Tracks product warranty registration by a manufacturer and ownership
 *      transfers between product owners, enforcing all rules on-chain.
 */
contract ProductWarrantyRegistry {
    struct Warranty {
        string productId;
        address currentOwner;
        uint256 expirationTime;
        uint256 registeredAt;
        bool exists;
    }

    address public immutable manufacturer;

    mapping(string => Warranty) private warranties;
    string[] private productIds;

    event ProductRegistered(
        string productId,
        address indexed owner,
        uint256 expirationTime,
        uint256 registeredAt
    );

    event OwnershipTransferred(
        string productId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 transferredAt
    );

    modifier onlyManufacturer() {
        require(msg.sender == manufacturer, "Only manufacturer can perform this action");
        _;
    }

    modifier productExists(string memory productId) {
        require(warranties[productId].exists, "Product is not registered");
        _;
    }

    modifier onlyCurrentOwner(string memory productId) {
        require(
            msg.sender == warranties[productId].currentOwner,
            "Only the current owner can transfer ownership"
        );
        _;
    }

    constructor() {
        manufacturer = msg.sender;
    }

    /**
     * @notice Registers a new product warranty. Only callable by the manufacturer.
     * @param productId Unique product identifier (e.g., "LAPTOP-2026-001").
     * @param owner Initial owner address.
     * @param expirationTime Unix timestamp (seconds) when the warranty expires.
     */
    function registerProduct(
        string calldata productId,
        address owner,
        uint256 expirationTime
    ) external onlyManufacturer {
        require(bytes(productId).length > 0, "Product ID cannot be empty");
        require(!warranties[productId].exists, "Product ID already registered");
        require(owner != address(0), "Owner cannot be the zero address");
        require(expirationTime > block.timestamp, "Expiration time must be in the future");

        warranties[productId] = Warranty({
            productId: productId,
            currentOwner: owner,
            expirationTime: expirationTime,
            registeredAt: block.timestamp,
            exists: true
        });

        productIds.push(productId);

        emit ProductRegistered(productId, owner, expirationTime, block.timestamp);
    }

    /**
     * @notice Transfers product warranty ownership to a new owner.
     *         Only callable by the current owner.
     * @param productId Registered product identifier.
     * @param newOwner Address of the new owner.
     */
    function transferOwnership(
        string calldata productId,
        address newOwner
    ) external productExists(productId) onlyCurrentOwner(productId) {
        require(newOwner != address(0), "New owner cannot be the zero address");
        address previousOwner = warranties[productId].currentOwner;
        require(newOwner != previousOwner, "New owner must differ from current owner");

        warranties[productId].currentOwner = newOwner;

        emit OwnershipTransferred(productId, previousOwner, newOwner, block.timestamp);
    }

    /**
     * @notice Returns whether a registered product's warranty is currently active.
     * @param productId Product identifier to check.
     */
    function isWarrantyActive(string calldata productId) public view returns (bool) {
        Warranty storage w = warranties[productId];
        return w.exists && block.timestamp <= w.expirationTime;
    }

    /**
     * @notice Returns full warranty details for a product.
     * @param productId Product identifier to query.
     */
    function getWarranty(
        string calldata productId
    )
        external
        view
        returns (
            string memory id,
            address manufacturerAddr,
            address currentOwner,
            uint256 expirationTime,
            uint256 registeredAt,
            bool isActive,
            bool exists
        )
    {
        Warranty storage w = warranties[productId];
        return (
            w.productId,
            manufacturer,
            w.currentOwner,
            w.expirationTime,
            w.registeredAt,
            w.exists && block.timestamp <= w.expirationTime,
            w.exists
        );
    }

    /**
     * @notice Returns the total number of registered products.
     */
    function getProductCount() external view returns (uint256) {
        return productIds.length;
    }

    /**
     * @notice Returns all registered product IDs.
     */
    function getAllProductIds() external view returns (string[] memory) {
        return productIds;
    }
}
