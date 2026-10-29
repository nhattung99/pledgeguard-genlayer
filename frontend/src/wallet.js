// Studionet signing uses standard EIP-1193 requests; it does not require Snaps.
export async function ensureWalletNetwork(provider, chain) {
  if (!provider?.request) {
    throw new Error("Open this app in a browser with an Ethereum wallet.");
  }
  const chainId = `0x${chain.id.toString(16)}`;
  const matches = (value) => {
    try {
      return BigInt(value) === BigInt(chain.id);
    } catch {
      return false;
    }
  };
  if (matches(await provider.request({ method: "eth_chainId" }))) return;
  const switchNetwork = () =>
    provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  try {
    await switchNetwork();
  } catch (error) {
    const code = error?.code ?? error?.data?.originalError?.code;
    if (Number(code) !== 4902) throw error;
    const explorer = chain.blockExplorers?.default?.url;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          ...(explorer ? { blockExplorerUrls: [explorer] } : {}),
        },
      ],
    });
    await switchNetwork();
  }
  if (!matches(await provider.request({ method: "eth_chainId" }))) {
    throw new Error(
      "Switch your wallet to GenLayer studionet (chain ID 61999) and try again.",
    );
  }
}
