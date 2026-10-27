import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGenToWei, formatWeiToGen } from "../frontend/src/money.js";
import { violations } from "../scripts/check-no-float-money.js";
import { buildCriteria } from "../frontend/src/criteria.js";
test("exact wei roundtrips including values beyond safe integer range", () => {
  for (const value of [
    "0",
    "1",
    "0.000000000000000001",
    "9007199254740993.999999999999999999",
    "1.000000000000000001",
    "123.123456789123456789",
  ])
    assert.equal(formatWeiToGen(parseGenToWei(value)), value);
});
test("malformed or overprecision money rejected", () => {
  for (const value of [
    "1e18",
    "NaN",
    "Infinity",
    "-1",
    "1.0000000000000000001",
    "",
    "1,000",
    ".1",
    "1.",
  ])
    assert.equal(parseGenToWei(value), 0n);
});
test("format handles absent and signed values", () => {
  assert.equal(formatWeiToGen(null), "0");
  assert.equal(formatWeiToGen(-1n), "-0.000000000000000001");
});
test("money guard catches dangerous operations across nearby lines", () => {
  assert.deepEqual(
    violations("const stake = 5;\nconst rounded = Math.round(value);"),
    [2],
  );
  assert.deepEqual(violations("const payout = parseFloat(input);"), [1]);
  assert.deepEqual(violations("const time = Math.floor(Date.now()/1000);"), []);
});
test("criteria selections produce locked measurable English rules", () => {
  assert.match(
    buildCriteria("code", 15, [0]),
    /at least 15 substantive commits/,
  );
  assert.match(buildCriteria("writing", 1000, []), /at least 1000 words/);
  assert.match(buildCriteria("course", 3, [1]), /platform-issued/);
  assert.throws(() => buildCriteria("code", 999, []));
});
