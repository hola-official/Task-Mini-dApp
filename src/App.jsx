import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {  toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import abi from "./abi.json"

const contractABI = abi;

const contractAddress = "0x17282d6Ad90e84E24ee68fe68fD01014D9B8d7B3";

const TaskApp = () => {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if we're on the correct network
  const checkNetwork = async (provider) => {
    try {
      const network = await provider.getNetwork();
      // Replace with your expected network ID
      const expectedNetwork = 1; // 1 for mainnet, 5 for goerli, etc.
      if (network.chainId !== expectedNetwork) {
        toast.error("Please connect to the correct network!");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Network check failed:", error);
      return false;
    }
  };

  // Initialize web3 and contract
  useEffect(() => {
    const init = async () => {
      try {
        if (!window.ethereum) {
          toast.error("Please install MetaMask!");
          return;
        }

        await connectWallet();
        setIsInitialized(true);
      } catch (error) {
        console.error("Initialization failed:", error);
        toast.error("Failed to initialize the application");
      }
    };

    if (!isInitialized) {
      init();
    }

    // Setup event listeners
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountChange);
      window.ethereum.on("chainChanged", () => window.location.reload());
    }

    // Cleanup
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountChange);
      }
    };
  }, [isInitialized]);

  const handleAccountChange = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      setAccount("");
      setTasks([]);
      toast.info("Wallet disconnected");
    } else {
      setAccount(accounts[0]);
      if (contract) {
        await loadTasks(contract);
      }
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);

      // Check network before proceeding
      const isCorrectNetwork = await checkNetwork(provider);
      if (!isCorrectNetwork) return;

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const signer = provider.getSigner();
      const taskContract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      // Verify contract existence
      const code = await provider.getCode(contractAddress);
      if (code === "0x") {
        throw new Error("Contract not deployed at specified address");
      }

      setAccount(accounts[0]);
      setContract(taskContract);
      await loadTasks(taskContract);
      toast.success("Wallet connected successfully!");
    } catch (error) {
      console.error("Wallet connection failed:", error);
      toast.error(error.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (taskContract) => {
    if (!account || !taskContract) {
      console.warn("Cannot load tasks: wallet not connected");
      return;
    }

    try {
      setLoading(true);
      const allTasks = await taskContract.getMyTask();
      // Filter out deleted tasks and sort by ID
      const activeTasks = allTasks
        .filter((task) => !task.isDeleted)
        .sort((a, b) => b.id - a.id);
      setTasks(activeTasks);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Error loading tasks: " + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  const validateTaskInput = () => {
    if (!newTask.title.trim()) {
      toast.error("Task title cannot be empty");
      return false;
    }
    if (!newTask.text.trim()) {
      toast.error("Task description cannot be empty");
      return false;
    }
    if (newTask.title.length > 100) {
      toast.error("Task title too long (max 100 characters)");
      return false;
    }
    if (newTask.text.length > 500) {
      toast.error("Task description too long (max 500 characters)");
      return false;
    }
    return true;
  };

  const addTask = async (e) => {
    e.preventDefault();

    if (!account) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!validateTaskInput()) {
      return;
    }

    try {
      setLoading(true);
      const tx = await contract.addTask(
        newTask.text.trim(),
        newTask.title.trim(),
        false,
        { gasLimit: 200000 } // Specify gas limit
      );

      toast.info("Adding task... Please wait for confirmation");

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      // Check for AddTask event
      const event = receipt.events?.find((e) => e.event === "AddTask");
      if (!event) {
        throw new Error("Add task event not found in transaction");
      }

      toast.success("Task added successfully!");
      setNewTask({ title: "", text: "" });
      await loadTasks(contract);
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId) => {
    if (!account) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      const tx = await contract.deleteTask(taskId, { gasLimit: 100000 });

      toast.info("Deleting task... Please wait for confirmation");

      const receipt = await tx.wait();

      // Check for DeleteTask event
      const event = receipt.events?.find((e) => e.event === "DeleteTask");
      if (!event) {
        throw new Error("Delete task event not found in transaction");
      }

      toast.success("Task deleted successfully!");
      await loadTasks(contract);
    } catch (error) {
      console.error("Failed to delete task:", error);
      if (error.message.includes("owner")) {
        toast.error("You are not the owner of this task");
      } else {
        toast.error(error.reason || error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">

      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Task Manager dApp
            </h1>
            <div className="text-sm text-gray-600">
              {account ? (
                <div className="flex items-center space-x-2">
                  <span className="px-4 py-2 bg-gray-100 rounded-md">
                    {`${account.slice(0, 6)}...${account.slice(-4)}`}
                  </span>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {loading ? "Connecting..." : "Connect Wallet"}
                </button>
              )}
            </div>
          </div>

          {account && (
            <form onSubmit={addTask} className="mb-6">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Task Title (max 100 chars)"
                  className="w-full p-2 border rounded-md"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  maxLength={100}
                  disabled={loading}
                  required
                />
              </div>
              <div className="mb-4">
                <textarea
                  placeholder="Task Description (max 500 chars)"
                  className="w-full p-2 border rounded-md"
                  value={newTask.text}
                  onChange={(e) =>
                    setNewTask({ ...newTask, text: e.target.value })
                  }
                  maxLength={500}
                  disabled={loading}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400"
              >
                {loading ? "Processing..." : "Add Task"}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {!account ? (
              <div className="text-center text-gray-600">
                Please connect your wallet to view tasks
              </div>
            ) : loading ? (
              <div className="text-center text-gray-600">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center text-gray-600">No tasks found</div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id.toString()}
                  className="border rounded-md p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {task.taskTitle}
                      </h3>
                      <p className="text-gray-600 mt-1">{task.taskText}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        ID: {task.id.toString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      disabled={loading}
                      className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 disabled:bg-gray-400 ml-4"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskApp;
