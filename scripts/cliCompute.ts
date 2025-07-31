import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

async function main() {
  dotenv.config({ path: __dirname + '/../.env' });

  const [aArg, bArg, userAddress] = process.argv.slice(2);
  if (!aArg || !bArg || !userAddress) {
    console.log('Usage: npm run cli -- <A> <B> <userAddress>');
    process.exit(1);
  }

  await initSDK();
  const instance = await createInstance({
    ...SepoliaConfig,
    relayerUrl: process.env.RELAYER_URI,
  });

  const buffer = instance.createEncryptedInput(
    process.env.CONTRACT_ADDRESS!,
    userAddress
  );
  buffer.add64(Number(aArg));
  buffer.add64(Number(bArg));
  const { handles, proof } = await buffer.encrypt();

  const provider = new ethers.InfuraProvider(
    'sepolia',
    process.env.INFURA_API_KEY
  );
  let wallet: ethers.Wallet;
  if (process.env.PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  } else if (process.env.MNEMONIC) {
    wallet = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(provider);
  } else {
    throw new Error('No PRIVATE_KEY or MNEMONIC provided');
  }

  const abi = require('../artifacts/contracts/EncryptedAdder.sol/EncryptedAdder.json').abi;
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, abi, wallet);
  let tx = await contract.setInputs(handles[0], handles[1], proof);
  await tx.wait();
  tx = await contract.computeSum();
  await tx.wait();

  const sumHandle = await contract.getLatestSum();

  const keypair = instance.generateKeypair();
  const startTs = Math.floor(Date.now() / 1000);
  const durationDays = 365;
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    [process.env.CONTRACT_ADDRESS!],
    startTs,
    durationDays
  );
  const signature = await wallet.signTypedData(eip712.domain, eip712.types, eip712.message);

  const result = await instance.userDecrypt(
    [{ handle: sumHandle, contractAddress: process.env.CONTRACT_ADDRESS! }],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    [process.env.CONTRACT_ADDRESS!],
    userAddress,
    startTs,
    durationDays
  );

  console.log('Plain sum:', result[sumHandle]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
