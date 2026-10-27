export const WEI_PER_GEN = 1000000000000000000n;
export function parseGenToWei(value) {
  const text = String(value ?? "").trim();
  // Reject excess precision instead of silently discarding a user's money.
  if (!/^\d+(\.\d{1,18})?$/.test(text)) return 0n;
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole + fraction.padEnd(18, "0"));
}
export function formatWeiToGen(value) {
  if (value === null || value === undefined || value === "") return "0";
  let wei;
  try {
    wei = BigInt(value);
  } catch {
    return String(value);
  }
  const sign = wei < 0n ? "-" : "";
  if (wei < 0n) wei = -wei;
  const whole = wei / WEI_PER_GEN;
  const fraction = (wei % WEI_PER_GEN)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${fraction ? "." + fraction : ""}`;
}
