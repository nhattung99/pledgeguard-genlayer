import { test } from "node:test";
import assert from "node:assert/strict";
import { abi } from "../frontend/node_modules/genlayer-js/dist/index.js";
import { CalldataAddress } from "../frontend/node_modules/genlayer-js/dist/types/index.js";
import {
  prepareContractArgs,
  assertSuccessfulExecution,
  createPledgePreflight,
  assertSuccessfulPreflight,
} from "../frontend/src/transactions.js";

const beneficiary = "0x20bD0e407731477F2df6EC167A4189ba25C65988";
const { calldata } = abi;

test("creation preflight preserves exact stake and UTC clock and fails closed", () => {
  const args = prepareContractArgs("create_pledge", [
    beneficiary,
    "title",
    "criteria",
    1793400000n,
  ]);
  const request = createPledgePreflight(
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    args,
    1000000000000000001n,
    1793267126000,
  );
  assert.equal(request.value, "1000000000000000001");
  assert.equal(request.type, "write");
  assert.equal(request.sim_config.genvm_datetime, "2026-10-29T09:45:26.000Z");
  assert.doesNotThrow(() =>
    assertSuccessfulPreflight({ execution_result: "SUCCESS" }),
  );
  for (const receipt of [
    {},
    { execution_result: "ERROR" },
    { execution_result: "PENDING" },
  ])
    assert.throws(
      () => assertSuccessfulPreflight(receipt),
      /No transaction was sent/,
    );
});
test("create pledge encodes beneficiary as an Address, not a string", () => {
  const input = [beneficiary, "A title", "Criteria", 1793400000n];
  const prepared = prepareContractArgs("create_pledge", input);
  const decoded = calldata.decode(
    calldata.encode({ method: "create_pledge", args: prepared }),
  );
  const decodedArgs = decoded.get("args");
  assert.ok(decodedArgs[0] instanceof CalldataAddress);
  assert.equal(
    Buffer.from(decodedArgs[0].bytes).toString("hex"),
    beneficiary.slice(2).toLowerCase(),
  );
  assert.equal(decodedArgs[1], input[1]);
  assert.equal(decodedArgs[2], input[2]);
  assert.equal(BigInt(decodedArgs[3]), input[3]);
  assert.equal(input[0], beneficiary);
});
test("other call arguments and already-typed addresses retain their type", () => {
  const input = ["0", ["https://example.com"], ["https://example.org"]];
  assert.equal(prepareContractArgs("submit_evidence", input), input);
  const typed = prepareContractArgs("create_pledge", [beneficiary]);
  assert.equal(prepareContractArgs("create_pledge", typed), typed);
  assert.throws(
    () => prepareContractArgs("create_pledge", ["wrong"]),
    /valid beneficiary/,
  );
});
test("accepted consensus is not treated as successful execution", () => {
  const receipt = {
    status: "ACCEPTED",
    consensus_data: {
      leader_receipt: [
        {
          execution_result: "ERROR",
          genvm_result: {
            stderr:
              "Traceback (most recent call last):\nAttributeError: 'str' object has no attribute 'as_bytes'\n",
          },
        },
      ],
    },
  };
  assert.throws(
    () => assertSuccessfulExecution(receipt, "0x123"),
    /AttributeError: 'str' object has no attribute 'as_bytes'/,
  );
  assert.throws(
    () => assertSuccessfulExecution(receipt, "0x123"),
    /Do not assume attached GEN was refunded/,
  );
});
test("use final leader outcome after rotations and accept successful execution", () => {
  assert.doesNotThrow(() =>
    assertSuccessfulExecution(
      {
        consensus_data: {
          leader_receipt: [
            { execution_result: "ERROR" },
            { execution_result: "SUCCESS" },
          ],
        },
      },
      "hash",
    ),
  );
  assert.throws(
    () => assertSuccessfulExecution({ status: "PENDING" }, "hash"),
    /PENDING/,
  );
});
