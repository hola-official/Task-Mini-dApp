import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import abi from "./abi.json";

const contractAddress = "0x17282d6Ad90e84E24ee68fe68fD01014D9B8d7B3";
const contractABI = abi;

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newTask, setNewTask] = useState({ title: "", text: "" });

  // Initialize web3 connection
  const initializeWeb3 = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask");
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAccount(accounts[0]);

      // Create contract instance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );
      setContract(contractInstance);

      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts) => {
        setAccount(accounts[0]);
      });
    } catch (err) {
      setError(err.message);
    }
  };

  // console.log(contract.getMyTask());
  // Fetch all tasks
  const fetchTasks = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const taskList = await contract.getMyTask();
      console.log(taskList)
      setTasks(taskList.filter((task) => !task.isDeleted));
    } catch (err) {
      setError(`Failed to fetch tasks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Add new task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.addTask(newTask.text, newTask.title, false);
      await tx.wait();

      setNewTask({ title: "", text: "" });
      await fetchTasks();
    } catch (err) {
      setError(`Failed to add task: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!contract) return;

    try {
      setLoading(true);
      const tx = await contract.deleteTask(taskId);
      await tx.wait();

      await fetchTasks();
    } catch (err) {
      setError(`Failed to delete task: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Initialize on component mount
  useEffect(() => {
    initializeWeb3();
  }, []);

  // Fetch tasks when contract is available
  useEffect(() => {
    if (contract) {
      fetchTasks();
    }
  }, [contract]);

  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">Task Manager DApp</h1>
          <p className="text-sm text-gray-600">
            Connected Account: {account || "Not connected"}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleAddTask} className="mb-6">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Task Title"
              value={newTask.title}
              onChange={(e) =>
                setNewTask((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="mb-4">
            <textarea
              placeholder="Task Description"
              value={newTask.text}
              onChange={(e) =>
                setNewTask((prev) => ({ ...prev, text: e.target.value }))
              }
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !contract}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? "Processing..." : "Add Task"}
          </button>
        </form>

        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id.toString()} className="border p-4 rounded">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-bold">{task.taskTitle}</h3>
                  <p className="text-gray-600">{task.taskText}</p>
                </div>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
