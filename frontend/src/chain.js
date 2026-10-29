import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { isAddress } from "viem";
import { ensureWalletNetwork } from "./wallet.js";
import {
  prepareContractArgs,
  assertSuccessfulExecution,
  createPledgePreflight,
  assertSuccessfulPreflight,
} from "./transactions.js";

export const contractAddress = (
  import.meta.env.VITE_CONTRACT_ADDRESS || ""
).trim();
export const configured =
  isAddress(contractAddress) && !/^0x0{40}$/i.test(contractAddress);
export const network = studionet;
const reader = createClient({ chain: studionet });
export async function readPledges(page = 0) {
  if (!configured) return { items: [], total: 0n };
  const total = BigInt(
    await reader.readContract({
      address: contractAddress,
      functionName: "get_pledge_count",
      args: [],
    }),
  );
  const end = total - BigInt(page * 12);
  const ids = [];
  for (let i = end - 1n; i >= 0n && ids.length < 12; i--)
    ids.push(i.toString());
  const items = await Promise.all(
    ids.map(async (id) => ({
      ...(await reader.readContract({
        address: contractAddress,
        functionName: "get_pledge",
        args: [id],
      })),
      id,
    })),
  );
  return { items, total };
}
export async function connectWallet() {
  if (!window.ethereum)
    throw new Error(
      "Install MetaMask or use a browser with an Ethereum wallet.",
    );
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  if (!accounts[0]) throw new Error("No wallet account selected.");
  await ensureWalletNetwork(window.ethereum, studionet);
  return accounts[0];
}
export async function sendTransaction(
  account,
  functionName,
  args,
  value = 0n,
  onHash,
) {
  if (!configured) throw new Error("The contract address is not configured.");
  if (!account)
    throw new Error("Connect your wallet before signing a transaction.");
  await ensureWalletNetwork(window.ethereum, studionet);
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (
    !accounts.some((address) => address.toLowerCase() === account.toLowerCase())
  ) {
    throw new Error("Your wallet account changed. Reconnect before signing.");
  }
  const client = createClient({
    chain: studionet,
    account,
    provider: window.ethereum,
  });
  const encodedArgs = prepareContractArgs(functionName, args);
  if (functionName === "create_pledge") {
    try {
      const simulation = await client.request({
        method: "sim_call",
        params: [
          createPledgePreflight(account, contractAddress, encodedArgs, value),
        ],
      });
      assertSuccessfulPreflight(simulation);
    } catch (error) {
      throw new Error(
        `Creation preflight failed; no transaction was sent. ${error.shortMessage || error.message || "Please try again later."}`,
      );
    }
  }
  const hash = await client.writeContract({
    address: contractAddress,
    functionName,
    args: encodedArgs,
    value,
  });
  onHash?.(hash);
  const receipt = await reader.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 3000,
    retries: 100,
    fullTransaction: true,
  });
  assertSuccessfulExecution(receipt, hash);
  return { hash, receipt };
}
