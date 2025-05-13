require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, API_URL } = process.env;

module.exports = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",  // Local Hardhat node URL
      accounts: [PRIVATE_KEY]  // Use the private key from .env file
    },
    sepolia: {
      url: API_URL,  // Infura API URL for Sepolia network
      accounts: [PRIVATE_KEY]  // Use the same private key for Sepolia
    }
  }
};
