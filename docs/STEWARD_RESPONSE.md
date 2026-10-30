# Steward revision — October 30, 2026

## Response to paste into the submission

The corrected source addresses both requested issues:

1. **Bounded SUBMITTED review with deterministic recovery.** On-time submissions retain a fixed 24-hour review grace period after the locked work deadline. Evidence/reference rendering errors remain retryable during that period. When `now > deadline + 86,400 seconds`, anyone can call `claim_expired_forfeit`; `resolve_evidence` also takes the same deterministic expiry branch. This branch performs no web fetch or AI call. It records expiry without inventing an AI verdict and emits the beneficiary payout through the existing saved-intent settlement mechanism. A synchronous payout-emission failure remains retryable without AI. Thus even permanent rendering failures, malformed AI output, or repeated validator disagreement cannot make a SUBMITTED pledge dependent on a future successful render/consensus round forever.

2. **Consensus on every nondeterministic settlement control.** Validators require exact agreement on the binary verdict and the boolean confidence gate `confidence >= 60`. Both the validator and state transition use the same `_settlement_eligible` helper. A 59/60 disagreement is rejected even when verdicts match. Different confidence numbers on the same side of the threshold are allowed because they cannot change the settlement branch. Money amounts, recipient selection, attempts, and time cutoffs come from deterministic locked contract state and transaction time.

Corrected source: https://github.com/nhattung99/pledgeguard-genlayer/blob/main/contracts/pledgeguard.py

Tests: https://github.com/nhattung99/pledgeguard-genlayer/blob/main/tests/test_pledgeguard.py

Verification: `npm run test:contract` passed **68 tests** using the pinned SDK and real gltest direct-mode runner. These are not claims of a newly deployed address or proven asynchronous payout delivery.

## Deployment status — do not omit from the submission

The previously submitted address `0xB8846C0e42778fc7aCFd1470Ead7a149AE8a4aa1` is immutable and still runs the old source. A new manual studionet deployment is required. After Studio confirms `Result: SUCCESS`, replace the submission's contract link and update the frontend environment to the new address. Do not describe the old address as patched. Existing funds and pledges do not migrate automatically.

## Rule and boundary details

| State                                | Review or recovery rule                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| AWAITING_EVIDENCE / DISPUTED         | Existing permissionless expiry after `now > deadline`                             |
| SUBMITTED, `now <= deadline + 86400` | Retry evidence resolution; direct forfeit is rejected                             |
| SUBMITTED, `now > deadline + 86400`  | Permissionless deterministic forfeit through either resolution/expiry entry point |
| PAYOUT_FAILED after timeout          | Retry the saved beneficiary and `EXPIRED_FORFEITED` intent; no AI                 |
| Already settled                      | Status/settled guards reject duplicate payouts                                    |

Timeout needs someone to submit the recovery transaction; it does not execute automatically. It does not refund the pledger as an escape hatch. The UI reads `review_timeout_at` from the revised contract, displays the cutoff, and only offers the new action for deployments exposing that capability.

## Regression coverage

- Permanently unavailable evidence URL and unavailable reference URL, including repeated clean reverts.
- Both permissionless recovery entry points after the review timeout, with web and AI functions prohibited by the test.
- Rejection before timeout and at its exact second; AI review still allowed at the exact boundary.
- Exact stake to the saved beneficiary, preserved evidence/history, no fabricated verdict, no duplicate recovery payout.
- Synchronous timeout transfer exception, `PAYOUT_FAILED`, and permissionless retry to the same beneficiary.
- KEPT and BROKEN with confidence 59/60 disagreement in both directions; agreement within the same confidence bucket.
- Opposite verdicts with the same confidence gate.
- Enforced validator rejection leaving both pledge state and balances unchanged, followed by deterministic timeout recovery.
- Validator reference-render failure and malformed-JSON resolution failure, followed by timeout recovery.
- The existing creation, authorization, immutable terms, attempts, deadline, prompt security, refund, forfeit, and retry regression suite.

The runner's direct mode does not establish multi-node network consensus, escrow debits, finality, or recipient credit from asynchronous messages. The existing asynchronous-transfer and unassigned-deposit limitations remain documented in README; this revision does not claim to repair funds already locked in the legacy deployment.
