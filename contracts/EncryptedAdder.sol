// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

// Контракт складывает два зашифрованных числа и сохраняет их сумму
contract EncryptedAdder is SepoliaConfig {
    // Зашифрованные переменные
    euint64 private _a;
    euint64 private _b;
    // Хранит последнее вычисленное значение суммы
    euint64 public latestSum;

    constructor() {}

    // Принимает зашифрованные A и B и их proof; сохраняет их в состоянии
    function setInputs(
        externalEuint64 encA,
        externalEuint64 encB,
        bytes calldata inputProof
    ) external {
        // Преобразуем внешние зашифрованные входы в euint64
        euint64 aInput = FHE.fromExternal(encA, inputProof);
        euint64 bInput = FHE.fromExternal(encB, inputProof);

        // Сохраняем в state
        _a = aInput;
        _b = bInput;

        // Обязательно выдаём права: контракту и пользователю
        FHE.allowThis(_a);
        FHE.allowThis(_b);
        FHE.allow(_a, msg.sender);
        FHE.allow(_b, msg.sender);
    }

    // Складывает A и B, сохраняет сумму в latestSum и выдаёт права
    function computeSum() external {
        // Проверяем, что оба значения инициализированы
        require(FHE.isInitialized(_a) && FHE.isInitialized(_b), "Values not set");

        // Выполняем сложение
        euint64 sum = FHE.add(_a, _b);

        // Сохраняем результат
        latestSum = sum;

        // Выдаём права на результат
        FHE.allowThis(latestSum);
        FHE.allow(latestSum, msg.sender);
    }

    /// @notice Returns the last computed encrypted sum
    function getLatestSum() external view returns (euint64) {
        return latestSum;
    }
}
