import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("AIModelRegistry", function () {
  let registry: any;
  let token: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const INITIAL_SUPPLY = ethers.parseEther("1000000");

    // Deploy MockToken
    token = await ethers.deployContract("MockToken", [INITIAL_SUPPLY]);

    // Deploy AIModelRegistry
    registry = await ethers.deployContract("AIModelRegistry", [await token.getAddress()]);

    // Distribute tokens to users for testing
    await token.transfer(user1.address, ethers.parseEther("10000"));
    await token.transfer(user2.address, ethers.parseEther("10000"));
  });

  describe("Deployment", function () {
    it("Should set the correct payment token", async function () {
      expect(await registry.paymentToken()).to.equal(await token.getAddress());
    });

    it("Should initialize with zero models", async function () {
      expect(await registry.modelCount()).to.equal(0);
    });
  });

  describe("Model Registration", function () {
    it("Should register a model successfully", async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");

      const tx = await registry.connect(owner).registerModel(
        "GPT-5",
        IPFS_HASH,
        MODEL_PRICE
      );

      await expect(tx).to.emit(registry, "ModelRegistered");

      expect(await registry.modelCount()).to.equal(1);

      const model = await registry.models(0);
      expect(model.owner).to.equal(owner.address);
      expect(model.name).to.equal("GPT-5");
      expect(model.ipfsHash).to.equal(IPFS_HASH);
      expect(model.accessPrice).to.equal(MODEL_PRICE);
    });

    it("Should give owner automatic access", async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");

      await registry.connect(owner).registerModel("GPT-5", IPFS_HASH, MODEL_PRICE);
      expect(await registry.hasAccess(0, owner.address)).to.be.true;
    });

    it("Should reject empty model name", async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");

      await expect(
        registry.connect(owner).registerModel("", IPFS_HASH, MODEL_PRICE)
      ).to.be.revertedWith("Name required");
    });

    it("Should reject empty IPFS hash", async function () {
      const MODEL_PRICE = ethers.parseEther("100");

      await expect(
        registry.connect(owner).registerModel("GPT-5", ethers.ZeroHash, MODEL_PRICE)
      ).to.be.revertedWith("IPFS hash required");
    });
  });

  describe("Access Purchase (ERC20 Settlement)", function () {
    beforeEach(async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");
      await registry.connect(owner).registerModel("GPT-5", IPFS_HASH, MODEL_PRICE);
    });

    it("Should purchase access with ERC20 tokens", async function () {
      const MODEL_PRICE = ethers.parseEther("100");

      await token.connect(user1).approve(await registry.getAddress(), MODEL_PRICE);

      const ownerBalanceBefore = await token.balanceOf(owner.address);

      const tx = await registry.connect(user1).purchaseAccess(0);

      await expect(tx).to.emit(registry, "AccessPurchased");

      expect(await registry.hasAccess(0, user1.address)).to.be.true;

      const ownerBalanceAfter = await token.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(MODEL_PRICE);
    });

    it("Should fail if user doesn't approve tokens", async function () {
      await expect(
        registry.connect(user1).purchaseAccess(0)
      ).to.be.revertedWith("Insufficient allowance");
    });

    it("Should fail if user already has access", async function () {
      const MODEL_PRICE = ethers.parseEther("100");

      await token.connect(user1).approve(await registry.getAddress(), MODEL_PRICE);
      await registry.connect(user1).purchaseAccess(0);

      await expect(
        registry.connect(user1).purchaseAccess(0)
      ).to.be.revertedWith("Already has access");
    });

    it("Should fail for non-existent model", async function () {
      await expect(
        registry.connect(user1).purchaseAccess(999)
      ).to.be.revertedWith("Model does not exist");
    });
  });

  describe("IPFS Hash Retrieval", function () {
    beforeEach(async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");
      await registry.connect(owner).registerModel("GPT-5", IPFS_HASH, MODEL_PRICE);
    });

    it("Should return IPFS hash for users with access", async function () {
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");
      const hash = await registry.connect(owner).getModelIPFS(0);
      expect(hash).to.equal(IPFS_HASH);
    });

    it("Should return zero hash for users without access", async function () {
      const hash = await registry.connect(user1).getModelIPFS(0);
      expect(hash).to.equal(ethers.ZeroHash);
    });

    it("Should return IPFS hash after purchasing access", async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");

      await token.connect(user1).approve(await registry.getAddress(), MODEL_PRICE);
      await registry.connect(user1).purchaseAccess(0);

      const hash = await registry.connect(user1).getModelIPFS(0);
      expect(hash).to.equal(IPFS_HASH);
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should register model with optimized gas", async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");

      const tx = await registry.connect(owner).registerModel(
        "GPT-5",
        IPFS_HASH,
        MODEL_PRICE
      );

      const receipt = await tx.wait();
      console.log("      Gas used for registration:", receipt?.gasUsed.toString());

      expect(receipt?.gasUsed).to.be.lessThan(165000n);
    });

    it("Should purchase access with optimized gas", async function () {
      const MODEL_PRICE = ethers.parseEther("100");
      const IPFS_HASH = ethers.encodeBytes32String("QmTest123");

      await registry.connect(owner).registerModel("GPT-5", IPFS_HASH, MODEL_PRICE);
      await token.connect(user1).approve(await registry.getAddress(), MODEL_PRICE);

      const tx = await registry.connect(user1).purchaseAccess(0);
      const receipt = await tx.wait();

      console.log("      Gas used for purchase:", receipt?.gasUsed.toString());

      expect(receipt?.gasUsed).to.be.lessThan(100000n);
    });
  });
});