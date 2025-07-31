// src/main.js

// ——————————————————————————————————————————————————————
// 1) Надёжный полифилл fetch из cross-fetch — самый первый импорт!
//    Этот модуль автоматически втыкает fetch в globalThis и window.
import 'cross-fetch/polyfill';

// 2) Полифиллы для Node.js API (Buffer, process)
import './polyfill.js';

// 3) Библиотека ethers уже безопасно импортируется после fetch-полифилла
import { ethers } from 'ethers';

// ——————————————————————————————————————————————————————
// Константы
const SERVER_URL       = 'http://localhost:3001';
const RELAYER_URI      = 'https://relayer.testnet.zama.cloud';
const CONTRACT_ADDRESS = '0x9342a00060e3A0dbc8d77a6C9F7c42cb62d5D0c6';

let sdkInstance;
let initSDK, createInstance, SepoliaConfig;

window.addEventListener("DOMContentLoaded", async () => {
  // 4) Динамически грузим Relayer SDK только после того, как fetch точно есть
  try {
    ({ initSDK, createInstance, SepoliaConfig } = await import(
      /* webpackChunkName: "zama-relayer-sdk" */
      '@zama-fhe/relayer-sdk/web'
    ));
  } catch (e) {
    console.error("❌ Не удалось загрузить Relayer SDK:", e);
    alert("Ошибка загрузки SDK. Проверь консоль.");
    return;
  }

  const computeBtn = document.getElementById("computeBtn");
  const status     = document.getElementById("status");
  const result     = document.getElementById("result");
  if (!computeBtn || !status || !result) {
    console.error("❌ DOM-элементы не найдены");
    return;
  }

  // 5) Инициализация SDK
  try {
    await initSDK();
    sdkInstance = await createInstance({
      ...SepoliaConfig,
      relayerUrl: RELAYER_URI
    });
    console.log("✅ SDK успешно инициализирован");
  } catch (err) {
    console.error("❌ Ошибка инициализации SDK:", err);
    alert("Не удалось инициализировать SDK. См. консоль.");
    return;
  }

  // 6) Обработчик кнопки
  computeBtn.addEventListener("click", async () => {
    const a = parseInt(document.getElementById("a").value, 10);
    const b = parseInt(document.getElementById("b").value, 10);
    if (isNaN(a) || isNaN(b)) {
      alert("Введите два числа");
      return;
    }

    computeBtn.disabled  = true;
    status.textContent   = "🔐 Encrypting…";
    result.textContent   = "";

    try {
      // a) Запрос прав в MetaMask
      const provider     = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer       = await provider.getSigner();
      const userAddress  = await signer.getAddress();

      // b) Шаг 1: шифрование на клиенте
      const buffer = sdkInstance.createEncryptedInput(CONTRACT_ADDRESS, userAddress);
      buffer.add64(a);
      buffer.add64(b);
      const { handles, inputProof } = await buffer.encrypt();
      const encA = handles[0];
      const encB = handles[1];
      const proof = inputProof;

      // c) Шаг 2: вычисление на бэкенде
      status.textContent = "⚙️ Computing…";
      const computeRes = await fetch(`${SERVER_URL}/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encA, encB, proof, userAddress })
      });
      const { sumHandle } = await computeRes.json();

      // d) Шаг 3: расшифровка
      status.textContent = "🔓 Decrypting…";
      const keypair      = sdkInstance.generateKeypair();
      const startTs      = Math.floor(Date.now() / 1000);
      const durationDays = 365;

      const eip712 = sdkInstance.createEIP712(
        keypair.publicKey,
        [CONTRACT_ADDRESS],
        startTs,
        durationDays
      );
      const signature = await signer.signTypedData(
        eip712.domain,
        eip712.types,
        eip712.message
      );

      const decryptRes = await fetch(`${SERVER_URL}/decrypt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sumHandle,
          userAddress,
          publicKey : Buffer.from(keypair.publicKey).toString("hex"),
          privateKey: Buffer.from(keypair.privateKey).toString("hex"),
          signature,
          startTs,
          durationDays
        })
      });
      const { plaintext } = await decryptRes.json();

      status.textContent = "";
      result.textContent = `✅ Sum: ${plaintext}`;
    } catch (err) {
      console.error("❌ Ошибка во время вычисления:", err);
      status.textContent = "❌ Ошибка";
      alert("Произошла ошибка. Проверь консоль.");
    } finally {
      computeBtn.disabled = false;
    }
  });
});
