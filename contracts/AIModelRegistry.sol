// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/**
 * @title AIModelRegistry
 * @notice Decentralized registry for AI models with ERC20-based access settlement
 * @dev Storage layout optimized for gas efficiency
 */
contract AIModelRegistry {
    
    // Gas-optimized struct: owner (20 bytes) + timestamp (8 bytes) = 28 bytes in one slot
    struct Model {
        address owner;           // 20 bytes
        uint64 registeredAt;     // 8 bytes - packed with owner
        bytes32 ipfsHash;        // 32 bytes - IPFS CID (separate slot)
        string name;             // Dynamic - separate slot
        uint256 accessPrice;     // 32 bytes - price in ERC20 tokens
    }
    
    // State variables
    mapping(uint256 => Model) public models;
    mapping(uint256 => mapping(address => bool)) public hasAccess;
    uint256 public modelCount;
    
    // Immutable for gas savings (set once in constructor if needed)
    address public immutable paymentToken;
    
    // Events for off-chain indexing
    event ModelRegistered(
        uint256 indexed modelId,
        address indexed owner,
        string name,
        bytes32 ipfsHash,
        uint256 accessPrice,
        uint64 timestamp
    );
    
    event AccessPurchased(
        uint256 indexed modelId,
        address indexed buyer,
        uint256 price,
        uint64 timestamp
    );
    
    /**
     * @notice Initialize registry with payment token
     * @param _paymentToken ERC20 token address for settlements
     */
    constructor(address _paymentToken) {
        require(_paymentToken != address(0), "Invalid token address");
        paymentToken = _paymentToken;
    }
    
    /**
     * @notice Register a new AI model
     * @param _name Model name
     * @param _ipfsHash IPFS content identifier (as bytes32 for gas efficiency)
     * @param _accessPrice Price in ERC20 tokens to access model
     */
    function registerModel(
        string calldata _name,
        bytes32 _ipfsHash,
        uint256 _accessPrice
    ) external returns (uint256) {
        require(bytes(_name).length > 0, "Name required");
        require(_ipfsHash != bytes32(0), "IPFS hash required");
        
        uint256 modelId = modelCount++;
        
        models[modelId] = Model({
            owner: msg.sender,
            registeredAt: uint64(block.timestamp),
            ipfsHash: _ipfsHash,
            name: _name,
            accessPrice: _accessPrice
        });
        
        // Owner gets automatic access
        hasAccess[modelId][msg.sender] = true;
        
        emit ModelRegistered(
            modelId,
            msg.sender,
            _name,
            _ipfsHash,
            _accessPrice,
            uint64(block.timestamp)
        );
        
        return modelId;
    }
    
    /**
     * @notice Purchase access to a model using ERC20 tokens
     * @param _modelId ID of the model to access
     * @dev User must approve this contract to spend tokens first
     */
    function purchaseAccess(uint256 _modelId) external {
        require(_modelId < modelCount, "Model does not exist");
        require(!hasAccess[_modelId][msg.sender], "Already has access");
        
        Model storage model = models[_modelId];
        require(model.accessPrice > 0, "Model is free");
        
        // ERC20 settlement: transferFrom pattern
        bool success = IERC20(paymentToken).transferFrom(
            msg.sender,
            model.owner,
            model.accessPrice
        );
        require(success, "Payment failed");
        
        hasAccess[_modelId][msg.sender] = true;
        
        emit AccessPurchased(
            _modelId,
            msg.sender,
            model.accessPrice,
            uint64(block.timestamp)
        );
    }
    
    /**
     * @notice Get model details (only IPFS hash if user has access)
     * @param _modelId ID of the model
     * @return ipfsHash IPFS CID if caller has access, otherwise bytes32(0)
     */
    function getModelIPFS(uint256 _modelId) external view returns (bytes32) {
        require(_modelId < modelCount, "Model does not exist");
        
        if (hasAccess[_modelId][msg.sender]) {
            return models[_modelId].ipfsHash;
        }
        return bytes32(0);
    }
    
    /**
     * @notice Check if address has access to model
     */
    function checkAccess(uint256 _modelId, address _user) external view returns (bool) {
        require(_modelId < modelCount, "Model does not exist");
        return hasAccess[_modelId][_user];
    }
}