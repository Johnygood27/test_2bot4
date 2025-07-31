import { expect } from "chai";
import hre, { ethers, FhevmType } from "hardhat";
import { EncryptedAdder, EncryptedAdder__factory } from "../types";

async function deploy() {
  const factory = (await ethers.getContractFactory("EncryptedAdder")) as EncryptedAdder__factory;
  const contract = (await factory.deploy()) as EncryptedAdder;
  return contract;
}

describe("EncryptedAdder", function () {
  it("should add two encrypted numbers correctly", async function () {
    const contract = await deploy();
    const [alice] = await ethers.getSigners();

    const input = hre.fhevm.createEncryptedInput(
      await contract.getAddress(),
      alice.address
    );
    input.add64(7);
    input.add64(5);
    const encrypted = await input.encrypt();

    await contract.connect(alice).setInputs(
      encrypted.handles[0],
      encrypted.handles[1],
      encrypted.inputProof
    );

    await contract.connect(alice).computeSum();

    const sumHandle = await contract.getLatestSum();

    const result = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      sumHandle,
      await contract.getAddress(),
      alice
    );

    expect(result).to.equal(12n);
  });
});
