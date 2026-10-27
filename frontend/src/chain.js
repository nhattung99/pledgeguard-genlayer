import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { isAddress } from "viem";

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
  const client = createClient({
    chain: studionet,
    account: accounts[0],
    provider: window.ethereum,
  });
  await client.connect("studionet");
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
  const client = createClient({
    chain: studionet,
    account,
    provider: window.ethereum,
  });
  await client.connect("studionet");
  const hash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
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
  const leaders = receipt.consensus_data?.leader_receipt;
  const leader = Array.isArray(leaders) ? leaders[0] : leaders;
  if (leader?.execution_result !== "SUCCESS")
    throw new Error(
      `Transaction execution has not been confirmed as successful. Hash: ${hash}. ${leader?.execution_result || receipt.status || ""}`,
    );
  return { hash, receipt };
}
