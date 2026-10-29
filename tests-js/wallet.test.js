import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureWalletNetwork } from "../frontend/src/wallet.js";

const chain = {
  id: 61999,
  name: "GenLayer studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } },
};
function wallet({
  initial = "0x1",
  unknown = false,
  reject = false,
  stuck = false,
} = {}) {
  let current = initial,
    added = false;
  const calls = [];
  return {
    calls,
    async request(request) {
      calls.push(request);
      if (
        request.method.startsWith("wallet_") &&
        request.method.includes("Snap")
      )
        throw new Error("wallet_getSnaps doesn't has corresponding handler");
      if (request.method === "eth_chainId") return current;
      if (request.method === "wallet_switchEthereumChain") {
        if (reject)
          throw Object.assign(new Error("User rejected request"), {
            code: 4001,
          });
        if (unknown && !added)
          throw Object.assign(new Error("Unknown chain"), { code: 4902 });
        if (!stuck) current = request.params[0].chainId;
        return null;
      }
      if (request.method === "wallet_addEthereumChain") {
        added = true;
        return null;
      }
      throw new Error(`Unexpected request: ${request.method}`);
    },
  };
}
test("wallet without Snaps switches to studionet using standard requests", async () => {
  const provider = wallet();
  await ensureWalletNetwork(provider, chain);
  assert.deepEqual(
    provider.calls.map((x) => x.method),
    ["eth_chainId", "wallet_switchEthereumChain", "eth_chainId"],
  );
  assert.equal(provider.calls[1].params[0].chainId, "0xf22f");
});
test("already-connected studionet wallet does not prompt again", async () => {
  const provider = wallet({ initial: "0xF22F" });
  await ensureWalletNetwork(provider, chain);
  assert.deepEqual(
    provider.calls.map((x) => x.method),
    ["eth_chainId"],
  );
});
test("unknown network adds only studionet then switches and verifies", async () => {
  const provider = wallet({ unknown: true });
  await ensureWalletNetwork(provider, chain);
  assert.equal(provider.calls[2].method, "wallet_addEthereumChain");
  assert.deepEqual(provider.calls[2].params[0].rpcUrls, [
    "https://studio.genlayer.com/api",
  ]);
});
test("user rejection is preserved and never triggers add-network fallback", async () => {
  const provider = wallet({ reject: true });
  await assert.rejects(ensureWalletNetwork(provider, chain), { code: 4001 });
  assert.equal(provider.calls.length, 2);
});
test("wallet remaining on the wrong network cannot continue", async () => {
  await assert.rejects(
    ensureWalletNetwork(wallet({ stuck: true }), chain),
    /61999/,
  );
});
