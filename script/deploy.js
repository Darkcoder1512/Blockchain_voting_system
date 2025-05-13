const hre = require("hardhat");

async function main() {
  const Voting = await hre.ethers.getContractFactory("Voting");
  const candidates = ["Alice", "Bob", "Charlie"]; // example candidate names

  // Deploy the contract with a custom gas limit (optional)
  const voting = await Voting.deploy(candidates, {
    gasLimit: 5000000, // Adjust gas limit if necessary
  });

  await voting.waitForDeployment();
  console.log("Contract deployed to:", await voting.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
