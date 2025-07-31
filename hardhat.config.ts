import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";


// Run 'npx hardhat vars setup' to see the list of variables that need to be set

const MNEMONIC: string = vars.get("MNEMONIC", "");
const PRIVATE_KEY: string = vars.get("PRIVATE_KEY", "");
const INFURA_API_KEY: string = vars.get("INFURA_API_KEY", "");

function validateMnemonic(m: string) {
  if (!m) return undefined;
  const words = m.trim().split(/\s+/);
  if (![12, 24].includes(words.length)) {
    throw new Error(
      "Invalid MNEMONIC: provide a 12 or 24 word phrase or remove the variable"
    );
  }
  return { mnemonic: m, path: "m/44'/60'/0'/0/", count: 10 } as const;
}

const mnemonicAccounts = validateMnemonic(MNEMONIC);

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: vars.get("ETHERSCAN_API_KEY", ""),
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      accounts: mnemonicAccounts,
      chainId: 31337,
    },
    anvil: {
      accounts: mnemonicAccounts,
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts:
        PRIVATE_KEY !== ""
          ? [PRIVATE_KEY]
          : mnemonicAccounts,
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          metadata: {
            // Not including the metadata hash
            // https://github.com/paulrberg/hardhat-template/issues/31
            bytecodeHash: "none",
          },
          optimizer: {
            enabled: true,
            runs: 800,
          },
          evmVersion: "cancun",
        },
        // Use the locally installed solc to avoid network downloads
        // Hardhat will use this JS build instead of fetching the compiler
        path: require.resolve("solc/soljson.js"),
      },
    ],
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
