// server/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import path from 'path';

// Node-версия Relayer SDK
const relayer = require('@zama-fhe/relayer-sdk/node');
const { createInstance, SepoliaConfig } = relayer;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Раздаём статические файлы из папки frontend
// Теперь при обращении к http://localhost:3001/ будет отдан index.html
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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

// 🔐 Шифрование A и B
app.post('/encrypt', async (req, res) => {
  const { a, b, userAddress } = req.body;
  // Проверяем, что a и b — числа, а адрес указан
  if (typeof a !== 'number' || typeof b !== 'number' || !userAddress) {
    return res.status(400).json({ error: 'Неверные входные данные: нужны числа a, b и userAddress' });
  }
  try {
    const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS!, userAddress);
    buffer.add64(a);
    buffer.add64(b);

    // encrypt() возвращает handles и inputProof
    const { handles, inputProof } = await buffer.encrypt();

    res.json({
      handleA: handles[0],
      handleB: handles[1],
      proof: inputProof,
    });
  } catch (err: any) {
    console.error('🧨 Ошибка при шифровании:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// ⚙️ Отправка зашифрованных данных в контракт и вычисление суммы
app.post('/compute', async (req, res) => {
  const { handleA, handleB, proof } = req.body;
  if (!handleA || !handleB || !proof) {
    return res.status(400).json({ error: 'Отсутствуют данные для вычисления (handles или proof)' });
  }
  try {
    const provider = new ethers.InfuraProvider('sepolia', INFURA_API_KEY);
    const wallet = PRIVATE_KEY
      ? new ethers.Wallet(PRIVATE_KEY, provider)
      : ethers.Wallet.fromPhrase(MNEMONIC!).connect(provider);

    // Загружаем ABI по корректному пути
    const abiPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'EncryptedAdder.sol', 'EncryptedAdder.json');
    const { abi } = require(abiPath);
    const contract = new ethers.Contract(CONTRACT_ADDRESS!, abi, wallet);

    // Превращаем объекты вида {0: 42, 1: 231, ...} в Buffer (BytesLike)
    const handleABuffer = Buffer.from(Object.values(handleA));
    const handleBBuffer = Buffer.from(Object.values(handleB));
    const proofBuffer   = Buffer.from(Object.values(proof));

    // Передаём дескрипторы и proof в контракт
    const tx1 = await contract.setInputs(handleABuffer, handleBBuffer, proofBuffer);
    await tx1.wait();

    const tx2 = await contract.computeSum();
    await tx2.wait();

    const sumHandle = await contract.getLatestSum();
    res.json({ sumHandle });
  } catch (err: any) {
    console.error('🧨 Ошибка при вычислении:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// 🔓 Расшифровка результата
app.post('/decrypt', async (req, res) => {
  const {
    sumHandle,
    userAddress,
    publicKey,
    privateKey,
    signature,
    startTs,
    durationDays,
  } = req.body;

  if (!sumHandle || !userAddress || !publicKey || !privateKey || !signature) {
    return res.status(400).json({ error: 'Недостаточно данных для расшифровки' });
  }
  try {
    const result = await instance.userDecrypt(
      [{ handle: sumHandle, contractAddress: CONTRACT_ADDRESS! }],
      Buffer.from(privateKey, 'hex'),
      Buffer.from(publicKey, 'hex'),
      signature,
      [CONTRACT_ADDRESS!],
      userAddress,
      startTs,
      durationDays
    );

    res.json({ plaintext: result[sumHandle] });
  } catch (err: any) {
    console.error('🧨 Ошибка при расшифровке:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});
