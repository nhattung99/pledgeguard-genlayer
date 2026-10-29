import { CalldataAddress } from "genlayer-js/types";
import { abi } from "genlayer-js";
import { hexToBytes, isAddress } from "viem";

export function prepareContractArgs(functionName, args) {
  if (functionName !== "create_pledge") return args;
  const [beneficiary, ...rest] = args;
  if (beneficiary instanceof CalldataAddress) return args;
  if (!isAddress(beneficiary))
    throw new Error("Enter a valid beneficiary wallet address.");
  // Python Address annotations do not coerce strings during calldata decoding.
  return [new CalldataAddress(hexToBytes(beneficiary)), ...rest];
}

export function createPledgePreflight(
  account,
  address,
  args,
  value,
  now = Date.now(),
) {
  return {
    type: "write",
    from: account,
    to: address,
    data: abi.transactions.serialize([
      abi.calldata.encode(
        abi.calldata.makeCalldataObject("create_pledge", args),
      ),
      false,
    ]),
    value: value.toString(),
    transaction_hash_variant: "latest-nonfinal",
    sim_config: { genvm_datetime: new Date(now).toISOString() },
  };
}

export function assertSuccessfulPreflight(receipt) {
  const receipts = receipt?.consensus_data?.leader_receipt;
  const leader = receipts
    ? Array.isArray(receipts)
      ? receipts.at(-1)
      : receipts
    : receipt;
  if (leader?.execution_result !== "SUCCESS") {
    throw new Error(
      "The contract simulation did not succeed. No transaction was sent and no stake was deposited.",
    );
  }
}

export function assertSuccessfulExecution(receipt, hash) {
  const receipts = receipt.consensus_data?.leader_receipt;
  const leaders = Array.isArray(receipts)
    ? receipts
    : receipts
      ? [receipts]
      : [];
  const leader = leaders.at(-1);
  if (leader?.execution_result === "SUCCESS") return;
  const stderr = leader?.genvm_result?.stderr;
  const tracebackError =
    typeof stderr === "string"
      ? stderr.trim().split(/\r?\n/).filter(Boolean).at(-1)
      : "";
  const detail =
    tracebackError ||
    leader?.genvm_result?.error_description ||
    leader?.error ||
    leader?.execution_result ||
    receipt.status ||
    "Unknown execution result";
  throw new Error(
    `Contract execution failed: ${String(detail).slice(0, 600)}. Transaction: ${hash}. Do not assume attached GEN was refunded; check the transaction and contract balance before retrying.`,
  );
}
