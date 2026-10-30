# Complete your first pledge

This example uses a new public focus-session report as one original deliverable. It involves three signed transactions: create, submit evidence, and request AI review. A refund is conditional on AI accepting the evidence; it is never guaranteed.

## Connect and prepare

1. Open https://pledgeguard-genlayer.vercel.app in a browser with an Ethereum wallet. Click **Connect wallet** and approve studionet (chain ID 61999). The app uses standard wallet network requests, not MetaMask Snaps.
2. You need studionet GEN for the stake and any network gas. Studio's built-in faucet is available through the account selector: https://studio.genlayer.com/. Make sure the funded address matches the wallet shown in PledgeGuard. Do not use a faucet for a different network.
3. Choose a different regular wallet address as beneficiary. Do not enter the PledgeGuard contract address. The beneficiary receives the stake if the pledge ultimately fails.

## Transaction 1: create

Use these form values:

| Field             | Value                                        |
| ----------------- | -------------------------------------------- |
| Pledge title      | Publish my first public focus-session report |
| Category          | Other                                        |
| At least          | 1 deliverable                                |
| Optional criteria | Leave both unchecked                         |
| Deadline          | 1 day                                        |
| Stake             | 0.1 GEN                                      |
| Beneficiary       | Your chosen different EOA wallet address     |

Review the generated English criteria, acknowledge the stake lock, click **Lock GEN & create pledge**, and sign. Wait for confirmation. Open the new pledge and record its creation time and deadline **before starting the work**.

## Create genuinely new work

After the pledge confirms, complete a focused work session and write a new report describing what you actually did. A suggested task is to review PledgeGuard's public evidence requirements, create your own checklist, and explain how you will avoid submitting unverifiable evidence.

Create a **public** repository named `pledgeguard-first-pledge` at https://github.com/new, or use a public repository you already control. Add `focus-session-report.md` through GitHub's web interface. Publishing through GitHub provides a platform commit timestamp. Do not backdate commits or submit an old report.

Copy this outline and replace every bracketed field with real information produced after pledge creation. The outline by itself is not completed evidence:

```markdown
# My first focus-session report

## Session

- Pledge ID: [actual pledge ID]
- Start time in UTC: [actual start time after pledge creation]
- End time in UTC: [actual end time before the deadline]
- Goal: [what I set out to complete]

## What I completed

[Describe the work in your own words. Include specific results.]

## My public-evidence checklist

[Write the checklist you developed during this session.]

## What I learned

[Explain at least three concrete observations from your work.]

## Outcome and next step

[Explain what you finished and what you will do next.]
```

Commit the completed file with message `Publish my first focus-session report`. Keep the repository public. The times you write yourself are context only; the platform commit record is the reference evidence.

## Transaction 2: submit

Open the completed file on GitHub and press **Y** to obtain a permanent link to that file at its commit. Open the commit details as the timestamp reference. Copy the actual URLs from GitHub; do not paste these literal placeholders:

```text
Deliverable link:
https://github.com/YOUR_USERNAME/pledgeguard-first-pledge/blob/ACTUAL_COMMIT_SHA/focus-session-report.md

Timestamp reference:
https://github.com/YOUR_USERNAME/pledgeguard-first-pledge/commit/ACTUAL_COMMIT_SHA
```

In your pledge, paste those URLs into **Deliverable link 1** and **Timestamp reference 1**. Click **Submit evidence** and sign. Wait for **Awaiting AI review**. Each accepted submission uses one of three attempts. A public GitHub link can still fail to render; the app does not guarantee a particular site's accessibility.

## Transaction 3: request AI review

For the October 30 steward revision, the contract must first be manually redeployed and the frontend pointed to its new address. The previous deployment does not gain the new timeout path from a source update.

Click **Request AI review**, sign, and wait for consensus. Read the verdict and reason:

- Confident `KEPT`: the contract emits a refund to the pledger.
- `BROKEN` with time and attempts left: improve the actual work and submit again.
- Low confidence: provide stronger evidence if another attempt is available.
- Final failure or expired forfeiture: the beneficiary receives the stake according to the contract rules.

If an evidence/reference URL cannot render, resolution can revert and remain retryable. For the revised contract, review stays open through the displayed review timeout, 24 hours after the work deadline. After that cutoff, anyone can use **Settle expired pledge** to emit the beneficiary payout without loading URLs or calling AI. `resolve_evidence` uses the same deterministic expiry path after the cutoff. This is an expiry rule, not a successful AI review. Validators must agree on the verdict and whether confidence reaches 60 before an AI result can control settlement.

`settled` means a payout message was emitted. Check the child transaction and recipient balance to confirm the credit; a parent verdict alone is insufficient. The app's **Retry payout** action handles synchronous emission failures only. See the README for asynchronous payout limitations.
