import { test } from "node:test";
import assert from "node:assert/strict";
import { canClaimExpiry } from "../frontend/src/pledge-state.js";
test("legacy submitted pledges never advertise unsupported timeout recovery", () => {
  assert.equal(
    canClaimExpiry({ status: "SUBMITTED", deadline: 10 }, 999999),
    false,
  );
});
test("submitted expiry respects the exposed review boundary", () => {
  const pledge = {
    status: "SUBMITTED",
    deadline: 10,
    review_timeout_at: 86410,
  };
  assert.equal(canClaimExpiry(pledge, 11), false);
  assert.equal(canClaimExpiry(pledge, 86410), false);
  assert.equal(canClaimExpiry(pledge, 86411), true);
});
test("ordinary expiry and terminal states remain distinct", () => {
  for (const status of ["AWAITING_EVIDENCE", "DISPUTED"]) {
    assert.equal(canClaimExpiry({ status, deadline: 10 }, 10), false);
    assert.equal(canClaimExpiry({ status, deadline: 10 }, 11), true);
  }
  for (const status of [
    "PAYOUT_FAILED",
    "RESOLVED_KEPT",
    "RESOLVED_BROKEN",
    "EXPIRED_FORFEITED",
  ]) {
    assert.equal(
      canClaimExpiry({ status, deadline: 10, review_timeout_at: 20 }, 999),
      false,
    );
  }
});
