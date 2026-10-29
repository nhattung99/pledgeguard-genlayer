# PledgeGuard

Keep your promise. Go further every day.

PledgeGuard stakes GEN on personal goals and uses GenLayer's decentralized AI consensus to judge public evidence against locked success criteria.

## Live App

[https://pledgeguard-genlayer.vercel.app](https://pledgeguard-genlayer.vercel.app)

Verified on October 27, 2026: an unauthenticated HEAD request returned HTTP 200, and the HTML response contained the PledgeGuard title and React root element.

## Deployed Contract

- Network: **GenLayer studionet**, chain ID **61999**.
- Address: `0xB8846C0e42778fc7aCFd1470Ead7a149AE8a4aa1`.
- Explorer: [View the deployed contract](https://genlayer-explorer.vercel.app/address/0xB8846C0e42778fc7aCFd1470Ead7a149AE8a4aa1).
- The project owner deployed the contract manually. This repository does not automatically deploy contracts.

Studionet is a development environment. Deployment alone does not verify escrow transfers, AI accuracy, or recipient balances.

## Run Locally

For a prepared example with form values, a report outline, evidence links, and all three transaction steps, read [Complete your first pledge](docs/FIRST_PLEDGE.md).

Requirements: Node.js 22.12 or later, Python 3.12 for tests, and MetaMask for signed transactions.

```powershell
npm ci --prefix frontend
python -m pip install -r requirements-test.txt
npm run dev
```

Set `frontend/.env` and restart Vite:

```dotenv
VITE_CONTRACT_ADDRESS=0xB8846C0e42778fc7aCFd1470Ead7a149AE8a4aa1
```

Without a valid address the app shows a configuration banner and disables writes. It never invents pledges or balances. Reads are public. Writes require a wallet on studionet, fixed through `genlayer-js/chains`.

Before requesting a creation signature, the frontend runs a non-persistent `sim_call` against the deployed contract with the exact typed arguments, stake, and explicit UTC clock. A failed or unavailable simulation blocks submission. This reduces failed deposits, but does not guarantee later signed execution will succeed.

Address arguments use SDK `CalldataAddress`, not plain strings: Python `Address` annotations do not convert calldata strings. On October 29, 2026, transaction `0x1f9e21176911ea527f3ecb513438983c6f94546fdb0fd9d50b8bcc00a361cb9c` exposed this integration bug. Execution failed while studionet still credited the attached 1 GEN to the contract, with pledge count zero. The existing contract has no withdrawal method for such unassigned deposits. An `ACCEPTED` or `FINALIZED` consensus status is not proof of successful execution or a refund.

## How It Works

1. Select measurable goal criteria, a deadline, a different beneficiary wallet, and a GEN stake. Terms are immutable after creation.
2. Create new public work within `[created_at, deadline]`. Submit deliverable links and platform timestamp references before expiry, at most three times.
3. Anyone can request AI review. The leader fetches evidence and checks every criterion. Validators rerun the evaluation and compare the binary verdict with exact equality.
4. A confident `KEPT` emits a refund. `BROKEN` allows resubmission while time and attempts remain; otherwise the beneficiary receives the stake. Anyone can settle expired pledges awaiting evidence or disputed.

```text
create_pledge + GEN -> AWAITING_EVIDENCE
submit_evidence -> SUBMITTED
resolve_evidence:
  confidence < 60 -> DISPUTED
  KEPT, confidence >= 60 -> RESOLVED_KEPT
  BROKEN, time and attempts remain -> AWAITING_EVIDENCE
  BROKEN, no attempts or deadline passed -> RESOLVED_BROKEN
claim_expired_forfeit:
  expired AWAITING_EVIDENCE / DISPUTED -> EXPIRED_FORFEITED
Synchronous payout emission exception -> PAYOUT_FAILED
retry_resolution -> saved recipient and success status, without AI
```

On-time `SUBMITTED` evidence must be reviewed even after expiry. Submission is allowed at the exact deadline second; forfeiture requires `now > deadline`. Low confidence on a final attempt remains disputed until expiry. Confidence is leader metadata, not a success probability or the percentage of agreeing validators.

Attempts are counted on submission. Public history preserves every submission, reference, timestamp, and result. All payout branches save recipient intent before invoking one settlement helper. There is no method to change criteria, beneficiary, stake, creation time, or deadline.

## Evidence and Security

The pledger bears the burden of proof. Work needs verifiable platform-generated timestamps within the locked UTC window. Missing, contradictory, old, or unverifiable evidence is `BROKEN`. A later archive snapshot alone does not prove creation after the pledge began; commit timestamps can also be manipulated.

All user content, including title and criteria, is marked `UNTRUSTED`. The prompt's `SECURITY RULE` forbids following instructions within evidence. This reduces prompt-injection risk without eliminating it.

Limits: title 160 characters; criteria 4,000 characters; one to three HTTPS deliverable URLs and one to three reference URLs per attempt; URL length 2,048 characters; fetched content capped at 20,000 characters per page. The frontend shows 12 pledges per page. Filters and status statistics apply to that page; total count comes from the contract.

## Six Honest Limitations

1. This is **a motivation tool, not a fraud-proof system**. Pledgers control their submissions and may fabricate evidence. Platform timestamps, the valid window, three-attempt limit, and burden of proof reduce but do not eliminate this risk.
2. **The beneficiary loses out if a pledger cheats.** Choose someone who can independently review the work. All submitted evidence is public.
3. AI can only inspect **public work readable through `web.render`**. Private pages, login walls, and automation blocks may cause fetch failures and transaction reverts. Objective, measurable criteria are more reliable.
4. A beneficiary contract that cannot receive funds may cause repeated failures and trapped funds. **Use a regular wallet address (EOA).** There is no pledger withdrawal escape hatch, since it would enable avoiding the penalty.
5. Prompt-injection defenses only reduce risk.
6. Criteria, deadline, and beneficiary cannot be changed after creation. Funds remain locked until resolution or expiry settlement.

### Asynchronous Payout Limitation

`emit_transfer` emits an asynchronous message. `settled` means a payout message was emitted, not that the recipient has been credited. `PAYOUT_FAILED` catches synchronous emission exceptions only. A later child-transaction failure does not return to that `try/except` or automatically enable retry. Retrying an already emitted message could double-pay, so it is not allowed. This design has no acknowledgement callback for later failures. Mock tests do not establish that every real transfer failure is recoverable.

## Money Handling Audit

**`stake_amount` is the only stored money field.** No percentage splits, platform fees, AI-selected amounts, or floating-point money operations exist.

| Location                      | Direction     | Representation                                                  |
| ----------------------------- | ------------- | --------------------------------------------------------------- |
| Stake input and chips         | Input         | Decimal string                                                  |
| Creation warnings             | Display       | `formatWeiToGen(parseGenToWei(stake))`                          |
| JavaScript transaction value  | Write         | `parseGenToWei(stake)` returns BigInt wei                       |
| Contract creation             | Storage write | Immutable `bigint(gl.message.value)`, checked greater than zero |
| SDK response                  | Read          | Integer base units; never converted to Number                   |
| Cards, details, expiry        | Display       | `formatWeiToGen(p.stake_amount)`                                |
| `_settle`                     | Intent write  | Recipient boolean and success status; no amount change          |
| `_try_settlement` and retries | Transfer      | Entire `u256(p.stake_amount)` passed to `emit_transfer`         |
| Other writes                  | Reject        | Attached value must be zero                                     |
| Platform fee                  | Display       | Constant `0 GEN`; wallet/SDK handles network gas separately     |

String parsing and BigInt preserve one-wei precision beyond `Number.MAX_SAFE_INTEGER`. Inputs over 18 decimal places are rejected rather than truncated. Number handles only dates, attempts, and pagination. The prebuild guard rejects `parseFloat`, `Math.round`, `Math.floor`, or `Math.ceil` near money-related names in JavaScript/JSX.

## SDK Compatibility

The header matches the Studio template verified on October 27, 2026:

```python
# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

`python scripts/inspect-studio.py` reads the public template without deploying.

| API                     | Implementation                                                             |
| ----------------------- | -------------------------------------------------------------------------- |
| Caller                  | `gl.message.sender_address`                                                |
| Time                    | `gl.message_raw["datetime"]`, parsed as UTC with integer-second arithmetic |
| Receive GEN             | `@gl.public.write.payable` on creation only                                |
| Send GEN                | `gl.get_contract_at(recipient).emit_transfer(value=u256(...))`             |
| Validator leader result | `leader_res.calldata`                                                      |
| Arrays                  | Storage `DynArray` initialized from lists; calldata uses `list[str]`       |
| Errors                  | `gl.vm.UserError`                                                          |

References: [value transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers), [JavaScript SDK](https://docs.genlayer.com/api-references/genlayer-js), and [testing](https://docs.genlayer.com/developers/intelligent-contracts/testing). Online documentation may target newer versions; tests use the pin above.

## Verification

```powershell
npm test
npm run test:contract
npm run build
npm audit --prefix frontend
cd frontend
npx playwright install chromium
cd ..
npm run test:ui
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an existing browser. Screenshots and results go to ignored `test-results/`. Mocked browser responses do not establish live contract correctness.

Contract tests use real gltest 0.29.2, SDK v0.2.16, and SDK storage in **direct mode**, without deploying to Studio. Mock setup invokes the real glsim `sim_installMocks` handler in-process before nondeterministic resolution, rather than JSON-RPC over a network. Fetch-failure tests deliberately omit responses. All three payout paths force synchronous exceptions from the EOA proxy and then retry with an unrelated caller.

The fixture compensates for installed runner defects: the old EOAProxy `_vm` alias, raw-message clock refresh on `warp`, and nondeterministic context during `run_validator`. It does not modify the contract or installed SDK. The parser handles raw JSON and dictionaries because the mock runner automatically parses JSON. Direct mode does not fully simulate escrow debits, gas, rollback, message queues, finality, or multi-node consensus. Mock recipient-credit assertions are not proof of network transfers.

Coverage includes refunds, failed attempts, resubmission, final failure, attempt limits, expiry and deadline boundaries, unauthorized submissions, low confidence, immutable terms, invalid input, public ABI, prompt security and timestamps, exact verdict comparison, double resolution, accidental value, and three payout-failure/retry paths.

## Deployment

Vercel settings: root directory **`frontend/`**, framework **Vite**, build command **`npm run build`**, output **`dist`**, production environment variable **`VITE_CONTRACT_ADDRESS`** set to the deployed address. Only confirmed URLs belong in Live App.

Full behavioral validation additionally needs MetaMask with separate pledger and beneficiary accounts, exact stake/state checks, and child-transaction and recipient-balance checks. Real `web.render` compatibility with public articles and commit histories remains to be verified; mock tests do not claim successful live fetches.
