import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  console.log("\n=== Decentralized AI Model Registry Demo ===\n");

  // Get signers
  const [owner, user1] = await ethers.getSigners();
  console.log("Owner address:", owner.address);
  console.log("User1 address:", user1.address);

  // Deploy MockToken
  console.log("\n1. Deploying MockToken...");
  const initialSupply = ethers.parseEther("1000000");
  const token = await ethers.deployContract("MockToken", [initialSupply]);
  await token.waitForDeployment();
  console.log("   MockToken deployed at:", await token.getAddress());

  // Deploy AIModelRegistry
  console.log("\n2. Deploying AIModelRegistry...");
  const registry = await ethers.deployContract("AIModelRegistry", [await token.getAddress()]);
  await registry.waitForDeployment();
  console.log("   AIModelRegistry deployed at:", await registry.getAddress());

  // Give user1 some tokens
  console.log("\n3. Distributing tokens to user1...");
  await token.transfer(user1.address, ethers.parseEther("10000"));
  console.log("   User1 balance:", ethers.formatEther(await token.balanceOf(user1.address)), "AIT");

  // Register a model
  console.log("\n4. Owner registering AI model...");
  const modelPrice = ethers.parseEther("100");
  const ipfsHash = ethers.encodeBytes32String("QmExampleHash123");
  
  const tx1 = await registry.connect(owner).registerModel(
    "GPT-5-Custom",
    ipfsHash,
    modelPrice
  );
  const receipt1 = await tx1.wait();
  console.log("   Model registered! Gas used:", receipt1?.gasUsed.toString());
  console.log("   Model ID: 0");
  console.log("   Model Name: GPT-5-Custom");
  console.log("   Access Price:", ethers.formatEther(modelPrice), "AIT");

  // User1 purchases access
  console.log("\n5. User1 purchasing access...");
  await token.connect(user1).approve(await registry.getAddress(), modelPrice);
  
  const tx2 = await registry.connect(user1).purchaseAccess(0);
  const receipt2 = await tx2.wait();
  console.log("   Access purchased! Gas used:", receipt2?.gasUsed.toString());

  // Verify access
  console.log("\n6. Verifying access...");
  const hasAccess = await registry.hasAccess(0, user1.address);
  console.log("   User1 has access:", hasAccess);

  // Retrieve IPFS hash
  const retrievedHash = await registry.connect(user1).getModelIPFS(0);
  console.log("   Retrieved IPFS hash:", ethers.decodeBytes32String(retrievedHash));

  // Final balances
  console.log("\n7. Final token balances:");
  console.log("   Owner:", ethers.formatEther(await token.balanceOf(owner.address)), "AIT");
  console.log("   User1:", ethers.formatEther(await token.balanceOf(user1.address)), "AIT");

  console.log("\n=== Demo Complete ===\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});