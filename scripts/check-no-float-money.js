import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export function violations(source) {
  const lines = source.split(/\r?\n/);
  const found = [];
  lines.forEach((line, i) => {
    if (
      /parseFloat|Math\.(?:round|floor|ceil)/i.test(line) &&
      /stake|amount|payout|refund|balance|wei|gen/i.test(
        lines.slice(Math.max(0, i - 3), i + 4).join("\n"),
      )
    )
      found.push(i + 1);
  });
  return found;
}
const root = fileURLToPath(new URL("../frontend/src", import.meta.url));
function scan(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? scan(path.join(dir, e.name))
      : /\.(js|jsx)$/.test(e.name)
        ? [path.join(dir, e.name)]
        : [],
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files = scan(root);
  const failures = files.flatMap((f) =>
    violations(readFileSync(f, "utf8")).map((n) => `${f}:${n}`),
  );
  if (failures.length) {
    console.error(
      "Unsafe floating point money operations:\n" + failures.join("\n"),
    );
    process.exitCode = 1;
  } else
    console.log(
      `PASS: no floating point money operations (${files.length} source files).`,
    );
}
