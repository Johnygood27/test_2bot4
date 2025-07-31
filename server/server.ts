// server/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';

// Node-версия Relayer SDK
const relayer = require('@zama-fhe/relayer-sdk/node');
const { createInstance, SepoliaConfig } = relayer;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Раздаём статические файлы из папки frontend
// Теперь при обращении к http://localhost:3001/ будет отдан index.html
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

const {
  RELAYER_URI,
  CONTRACT_ADDRESS,
  INFURA_API_KEY,
  PRIVATE_KEY,
  MNEMONIC,
  PORT = 3001,
} = process.env;

if (!RELAYER_URI || !CONTRACT_ADDRESS || !INFURA_API_KEY || (!PRIVATE_KEY && !MNEMONIC)) {
  console.error('❌ Отсутствуют обязательные переменные: RELAYER_URI, CONTRACT_ADDRESS, INFURA_API_KEY, PRIVATE_KEY/MNEMONIC');
  process.exit(1);
}

let instance: any;

// Инициализация relayer SDK
async function init() {
  try {
    instance = await createInstance({
      ...SepoliaConfig,
      relayerUrl: RELAYER_URI,
    });
    console.log('✅ Relayer инициализирован');
  } catch (error) {
    console.error('❌ Ошибка инициализации relayer:', error);
    process.exit(1);
  }
}
init();


// ⚙️ Отправка зашифрованных данных в контракт и вычисление суммы
app.post('/compute', async (req, res) => {
  const { encA, encB, proof, userAddress } = req.body;
  if (!encA || !encB || !proof || !userAddress) {
    return res
      .status(400)
      .json({ error: 'Отсутствуют данные для вычисления (handles, proof или userAddress)' });
  }
  try {
    const provider = new ethers.InfuraProvider('sepolia', INFURA_API_KEY);
    const wallet = PRIVATE_KEY
      ? new ethers.Wallet(PRIVATE_KEY, provider)
      : ethers.Wallet.fromPhrase(MNEMONIC!).connect(provider);

    // Загружаем ABI по корректному пути
    const abiPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'EncryptedAdder.sol', 'EncryptedAdder.json');
    const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const { abi } = artifact;
    const contract = new ethers.Contract(CONTRACT_ADDRESS!, abi, wallet);

    // Превращаем объекты вида {0: 42, 1: 231, ...} в Buffer (BytesLike)
    const handleABuffer = Buffer.from(Object.values(encA));
    const handleBBuffer = Buffer.from(Object.values(encB));
    const proofBuffer   = Buffer.from(Object.values(proof));

    // Передаём дескрипторы и proof в контракт
    const tx1 = await contract.setInputs(
      handleABuffer,
      handleBBuffer,
      proofBuffer,
      userAddress
    );
    await tx1.wait();

    const tx2 = await contract.computeSum(userAddress);
    await tx2.wait();

    const sumHandleRaw = await contract.getLatestSum();
    const sumHandle = Buffer.from(Object.values(sumHandleRaw));
    res.json({ sumHandle });
  } catch (err: any) {
    console.error('🧨 Ошибка при вычислении:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// 🔓 Расшифровка результата
app.post('/decrypt', async (req, res) => {
  const { sumHandle, signature, userAddress, publicKey, privateKey, startTs, durationDays } = req.body;

  if (!sumHandle || !signature || !userAddress || !publicKey || !privateKey) {
    return res.status(400).json({ error: 'Недостаточно данных для расшифровки' });
  }
  try {
    const result = await instance.userDecrypt({
      address: userAddress,
      signature,
      ciphertexts: [{ handle: sumHandle, contractAddress: CONTRACT_ADDRESS! }],
      publicKey: Buffer.from(publicKey, 'hex'),
      privateKey: Buffer.from(privateKey, 'hex'),
      startTimestamp: startTs,
      durationDays,
    });

    res.json({ plaintext: result[0] });
  } catch (err: any) {
    console.error('🧨 Ошибка при расшифровке:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// Проверка работоспособности
app.get('/status', (_req, res) => {
  res.json({ ok: true });
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});
