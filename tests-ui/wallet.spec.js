import {
  test,
  expect,
} from "../frontend/node_modules/@playwright/test/index.mjs";
test("connects a non-Snaps wallet using standard network switching", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.walletRequests = [];
    let chainId = "0x1";
    window.ethereum = {
      on() {},
      removeListener() {},
      async request({ method, params }) {
        window.walletRequests.push(method);
        if (method === "eth_requestAccounts" || method === "eth_accounts")
          return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return chainId;
        if (method === "wallet_switchEthereumChain") {
          chainId = params[0].chainId;
          return null;
        }
        throw new Error(`method [${method}] doesn't has corresponding handler`);
      },
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "0x1111…1111" })).toBeVisible();
  const requests = await page.evaluate(() => window.walletRequests);
  expect(requests).toContain("wallet_switchEthereumChain");
  expect(requests.some((method) => method.toLowerCase().includes("snap"))).toBe(
    false,
  );
});
