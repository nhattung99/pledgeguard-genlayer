import {
  test,
  expect,
} from "../frontend/node_modules/@playwright/test/index.mjs";
import { abi } from "../frontend/node_modules/genlayer-js/dist/index.js";
import { CalldataAddress } from "../frontend/node_modules/genlayer-js/dist/types/index.js";
import { hexToBytes } from "../frontend/node_modules/viem/_esm/index.js";

test("failed creation preflight blocks signing and uses typed beneficiary calldata", async ({
  page,
}) => {
  let simulation;
  await page.route("https://studio.genlayer.com/api", async (route) => {
    const request = route.request().postDataJSON();
    if (request.method === "sim_call") {
      simulation = request.params[0];
      await route.fulfill({
        json: {
          jsonrpc: "2.0",
          id: request.id,
          result: { execution_result: "ERROR" },
        },
      });
    } else await route.continue();
  });
  await page.addInitScript(() => {
    window.walletRequests = [];
    window.ethereum = {
      on() {},
      removeListener() {},
      async request({ method }) {
        window.walletRequests.push(method);
        if (method === "eth_requestAccounts" || method === "eth_accounts")
          return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return "0xf22f";
        throw new Error(`Unexpected wallet request: ${method}`);
      },
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "0x1111…1111" })).toBeVisible();
  await page.getByRole("button", { name: "Create your first pledge" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Pledge title", { exact: true })
    .fill("A new public report");
  await dialog
    .getByPlaceholder("0x… regular wallet address (EOA)")
    .fill("0x2222222222222222222222222222222222222222");
  await dialog
    .getByLabel("I understand the stake lock and accept this commitment.")
    .check();
  await dialog
    .getByRole("button", { name: "Lock GEN & create pledge" })
    .click();
  await expect(
    page.getByText(/Creation preflight failed; no transaction was sent/),
  ).toBeVisible();
  expect(simulation.value).toBe("1000000000000000000");
  // RLP wraps calldata and the leader-only flag; inspect the actual request.
  const { fromRlp } =
    await import("../frontend/node_modules/viem/_esm/index.js");
  const wrapped = fromRlp(simulation.data, "hex");
  const decoded = abi.calldata.decode(hexToBytes(wrapped[0]));
  expect(decoded.get("args")[0]).toBeInstanceOf(CalldataAddress);
  expect(
    await page.evaluate(() =>
      window.walletRequests.includes("eth_sendTransaction"),
    ),
  ).toBe(false);
});
