import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import VotingABI from "./VotingABI.json";

const CONTRACT_ADDRESSES = {
  "0xaa36a7": "0x8677b8B77181d10Dc93F2d88470C5A8f90ac7F74", // Sepolia Testnet
  "0x7a69": "0x68d1DD822148664dE9c3eed4bB7449376644a919" // Local Hardhat (chainId 31337 in hex is 0x7a69)
};

const NETWORK_INFO = {
  "0xaa36a7": {
    name: "Sepolia Testnet",
    currency: "SepoliaETH",
    explorer: "https://sepolia.etherscan.io",
    faucet: "https://sepoliafaucet.com"
  },
  "0x7a69": {
    name: "Local Hardhat",
    currency: "LocalETH",
    explorer: "",
    faucet: ""
  }
};

function App() {
  const [account, setAccount] = useState(null);
  const [candidates] = useState(["Alice", "Bob", "Charlie"]);
  const [contract, setContract] = useState(null);
  const [votes, setVotes] = useState({});
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet();
        }

        window.ethereum.on("accountsChanged", (accounts) => {
          setAccount(accounts[0] || null);
          if (accounts.length === 0) {
            setContract(null);
            setVotes({});
          } else {
            connectWallet();
          }
        });

        window.ethereum.on("chainChanged", () => {
          window.location.reload();
        });
      }
    };

    init();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", () => {});
        window.ethereum.removeListener("chainChanged", () => {});
      }
    };
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask!");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      
      const network = await provider.getNetwork();
      const chainId = `0x${network.chainId.toString(16)}`;
      setCurrentNetwork(chainId);

      if (!CONTRACT_ADDRESSES[chainId]) {
        setError(`Please switch to Sepolia Testnet or Local Hardhat (current: ${network.name})`);
        setIsLoading(false);
        return;
      }
      
      setAccount(addr);
      const voteContract = new ethers.Contract(
        CONTRACT_ADDRESSES[chainId],
        VotingABI.abi,
        signer
      );
      setContract(voteContract);
      
      // Check if user has already voted
      const voted = await voteContract.hasVoted(addr);
      setHasVoted(voted);
      
      await fetchVotes(voteContract);
    } catch (err) {
      setError(`Connection error: ${err.message}`);
      console.error("Connection error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVotes = async (contract) => {
    try {
      setIsLoading(true);
      const results = {};
      for (const c of candidates) {
        results[c] = await contract.getVotes(c);
      }
      setVotes(results);
    } catch (err) {
      setError(`Failed to fetch votes: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const vote = async () => {
    if (!selectedCandidate) {
      setError("Please select a candidate");
      return;
    }
    if (!contract) {
      setError("Contract not connected");
      return;
    }
    if (hasVoted) {
      setError("You have already voted!");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = await contract.vote(selectedCandidate);
      await tx.wait();
      setHasVoted(true);
      await fetchVotes(contract);
    } catch (err) {
      setError(`Voting failed: ${err.reason || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const switchToSepolia = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      await connectWallet();
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Test Network",
                rpcUrls: ["https://rpc.sepolia.org"],
                nativeCurrency: {
                  name: "Sepolia ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          await connectWallet();
        } catch (addError) {
          setError(`Failed to add Sepolia: ${addError.message}`);
        }
      } else {
        setError(`Failed to switch to Sepolia: ${switchError.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchToLocalHardhat = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x7a69", // 31337 in hex
            chainName: "Local Hardhat Network",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: {
              name: "Local ETH",
              symbol: "ETH",
              decimals: 18,
            },
            blockExplorerUrls: [""],
          },
        ],
      });
      await connectWallet();
    } catch (addError) {
      setError(`Failed to add Local Hardhat: ${addError.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    setAccount(null);
    setContract(null);
    setVotes({});
    setCurrentNetwork(null);
    setSelectedCandidate("");
    setHasVoted(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Address copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Blockchain Voting System</h1>
          <p className="mt-2 text-gray-600">Cast your vote securely on the blockchain</p>
        </div>

        {/* Status Indicators */}
        {isLoading && (
          <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-lg flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-lg flex items-center">
            <svg className="h-5 w-5 text-red-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Wallet Connection Section */}
        {!account ? (
          <div className="text-center py-8">
            <button 
              onClick={connectWallet} 
              disabled={isLoading}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415z" clipRule="evenodd" />
                  </svg>
                  Connect Wallet
                </>
              )}
            </button>
            <p className="mt-4 text-sm text-gray-500">
              You'll need to connect your MetaMask wallet to vote
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Connected Account</h2>
                  <p 
                    className="mt-1 text-sm text-gray-600 break-all cursor-pointer hover:text-indigo-600"
                    onClick={() => copyToClipboard(account)}
                    title="Click to copy"
                  >
                    {account}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {currentNetwork && NETWORK_INFO[currentNetwork] && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {NETWORK_INFO[currentNetwork].name}
                    </span>
                  )}
                  <button 
                    onClick={disconnectWallet}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {currentNetwork && NETWORK_INFO[currentNetwork] && currentNetwork !== "0xaa36a7" && currentNetwork !== "0x7a69" && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Wrong Network</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>Please switch to Sepolia Testnet or Local Hardhat to vote</p>
                      </div>
                      <div className="mt-2 space-x-2">
                        <button 
                          onClick={switchToSepolia} 
                          disabled={isLoading}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:bg-yellow-400"
                        >
                          Switch to Sepolia
                        </button>
                        <button 
                          onClick={switchToLocalHardhat} 
                          disabled={isLoading}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:bg-yellow-400"
                        >
                          Switch to Local
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {hasVoted && (
                <div className="mt-4 p-3 bg-green-50 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Vote Recorded</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>Thank you for voting! You cannot vote again.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Voting Section */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Vote for a Candidate</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Select your preferred candidate</p>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label htmlFor="candidate" className="block text-sm font-medium text-gray-700 mb-1">
                      Candidate
                    </label>
                    <select
                      id="candidate"
                      value={selectedCandidate}
                      onChange={(e) => setSelectedCandidate(e.target.value)}
                      disabled={!account || isLoading || hasVoted || (currentNetwork !== "0xaa36a7" && currentNetwork !== "0x7a69")}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:opacity-50"
                    >
                      <option value="">Select a candidate</option>
                      {candidates.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={vote}
                      disabled={!selectedCandidate || !account || (currentNetwork !== "0xaa36a7" && currentNetwork !== "0x7a69") || isLoading || hasVoted}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : hasVoted ? (
                        "Already Voted"
                      ) : (
                        "Submit Vote"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Current Results</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Live vote counts</p>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <ul className="divide-y divide-gray-200">
                  {candidates.map((c) => (
                    <li key={c} className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{c}</p>
                          </div>
                        </div>
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {votes[c]?.toString() || "0"} votes
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Faucet Link - Only show for Sepolia */}
            {currentNetwork === "0xaa36a7" && (
              <div className="text-center">
                <a 
                  href={NETWORK_INFO[currentNetwork].faucet} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Need test ETH? Visit Sepolia Faucet
                  <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;