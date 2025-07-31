import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

function checkInfura() {
  const key = process.env.INFURA_API_KEY || "";

  if (!/^[a-f0-9]{32}$/i.test(key)) {
    throw new Error("❌ Invalid INFURA_API_KEY in .env. Should be 32-character hex.");
  }

  console.log("✅ INFURA_API_KEY is valid");
}

async function main() {
  checkInfura();

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("🔨 Deploying with account:", deployerAddress);

  const factory = await ethers.getContractFactory("EncryptedAdder");
  const contract = await factory.deploy();

  await contract.waitForDeployment();

  // 💥 Никакого getAddress — используем .target (ethers v6)
  console.log("✅ EncryptedAdder deployed to:", contract.target);
}

main().catch((error) => {
  console.error("🔥 Deployment failed:", error);
  process.exit(1);
});
