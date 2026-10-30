import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Wallet,
  Globe,
  LockKeyhole,
  Check,
  Copy,
  Clock3,
  FileCheck2,
  ExternalLink,
  LoaderCircle,
  X,
  RefreshCw,
  Clipboard,
  ChevronDown,
  Leaf,
} from "lucide-react";
import { isAddress } from "viem";
import {
  configured,
  contractAddress,
  connectWallet,
  sendTransaction,
  readPledges,
} from "./chain.js";
import { parseGenToWei, formatWeiToGen } from "./money.js";
import { categories, buildCriteria } from "./criteria.js";
import "./style.css";
import { canClaimExpiry } from "./pledge-state.js";

const short = (a) =>
  a ? `${String(a).slice(0, 6)}…${String(a).slice(-4)}` : "Not connected";
const labels = {
  AWAITING_EVIDENCE: "In progress",
  SUBMITTED: "Awaiting AI review",
  DISPUTED: "More evidence needed",
  RESOLVED_KEPT: "Pledge kept",
  RESOLVED_BROKEN: "Pledge broken",
  EXPIRED_FORFEITED: "Expired and forfeited",
  PAYOUT_FAILED: "Payout failed",
};
const date = (ts) => new Date(Number(ts) * 1000).toLocaleString("en-US");
function remaining(deadline, now) {
  const s = Number(deadline) - now;
  if (s <= 0) return "Deadline passed";
  const days = Math.trunc(s / 86400);
  const hours = Math.trunc((s % 86400) / 3600);
  const minutes = Math.trunc((s % 3600) / 60);
  return days
    ? `${days} days ${hours} hours`
    : `${hours} hours ${minutes} minutes`;
}
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
function Url({ url }) {
  return safeUrl(url) ? (
    <a href={safeUrl(url)} target="_blank" rel="noreferrer">
      {url}
      <ExternalLink size={13} />
    </a>
  ) : (
    <span>{url}</span>
  );
}
function App() {
  const [account, setAccount] = useState(""),
    [view, setView] = useState("all"),
    [modal, setModal] = useState(false),
    [items, setItems] = useState([]),
    [total, setTotal] = useState(0n),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(null),
    [hash, setHash] = useState(""),
    [selected, setSelected] = useState(null),
    [now, setNow] = useState(Math.trunc(Date.now() / 1000));
  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      const result = await readPledges(page);
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      setMessage({
        error: true,
        text: `Could not load contract data: ${e.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Math.trunc(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return;
    const accountsChanged = (a) => setAccount(a[0] || "");
    const chainChanged = () => {
      setAccount("");
      setMessage({
        error: true,
        text: "Your wallet network changed. Reconnect to switch back to studionet.",
      });
    };
    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, []);
  async function connect() {
    try {
      setBusy("wallet");
      setAccount(await connectWallet());
    } catch (e) {
      setMessage({ error: true, text: e.message });
    } finally {
      setBusy("");
    }
  }
  async function transact(fn, args, value = 0n) {
    setBusy(fn);
    setHash("");
    setMessage(null);
    try {
      await sendTransaction(account, fn, args, value, setHash);
      setMessage({
        text: "Transaction executed successfully. Refreshing data; ACCEPTED transactions are still awaiting finality.",
      });
      setModal(false);
      await refresh();
      return true;
    } catch (e) {
      setMessage({ error: true, text: e.message });
      return false;
    } finally {
      setBusy("");
    }
  }
  const active = items.filter((p) => !p.settled),
    kept = items.filter((p) => p.status === "RESOLVED_KEPT");
  const visible = items.filter(
    (p) =>
      view === "all" ||
      (view === "mine" &&
        String(p.pledger).toLowerCase() === account.toLowerCase()) ||
      (view === "beneficiary" &&
        String(p.beneficiary).toLowerCase() === account.toLowerCase()),
  );
  const detail = selected && items.find((p) => p.id === selected);
  return (
    <>
      <div className="fee">
        <Leaf size={13} /> Free to use — you only pay GenLayer network gas when
        signing transactions. No platform fees.
      </div>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("all");
          }}
        >
          <span className="brand-icon">
            <ShieldCheck size={23} />
          </span>
          PledgeGuard<span className="brand-dot">.</span>
        </a>
        <nav>
          <button
            className={view === "all" ? "nav-active" : ""}
            onClick={() => setView("all")}
          >
            Explore
          </button>
          <button
            className={view === "mine" ? "nav-active" : ""}
            onClick={() => setView("mine")}
          >
            My pledges
          </button>
          <a href="#how">
            How it works <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="header-right">
          <span className="network">
            <i /> Studionet
          </span>
          <button className="wallet" disabled={!!busy} onClick={connect}>
            <Wallet size={16} />
            {busy === "wallet"
              ? "Connecting…"
              : account
                ? short(account)
                : "Connect wallet"}
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> REAL COMMITMENT. REAL MOMENTUM.
            </div>
            <h1>
              Keep your promise.
              <br />
              <em>Go further every day.</em>
            </h1>
            <p>
              Set a goal, stake a little GEN, and get to work.
              <br className="desktop" /> GenLayer AI verifies your public work.
              Keep your pledge and get your stake back.
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setModal(true)}>
                <Plus size={17} /> Create your first pledge{" "}
                <ArrowUpRight size={17} />
              </button>
              <a href="#how">
                See how it works <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-trust">
              <span>
                <LockKeyhole size={14} />
                Contract-held stakes
              </span>
              <span>
                <Globe size={14} />
                Public evidence
              </span>
              <span>
                <ShieldCheck size={14} />
                Neutral AI review
              </span>
            </div>
          </div>
          <div className="hero-art" aria-label="From promise to progress">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-star star-one">✧</div>
            <div className="art-star star-two">✦</div>
            <div className="promise-card">
              <div className="promise-top">
                <span className="little-icon">
                  <FileCheck2 size={20} />
                </span>
                <span>WHAT I WILL DO</span>
                <span className="tiny-dot" />
              </div>
              <h3>
                One promise.
                <br />
                One step forward.
              </h3>
              <div className="art-check">
                <span>
                  <Check size={13} />
                </span>
                A clear goal
              </div>
              <div className="art-check">
                <span>
                  <Check size={13} />
                </span>
                Effort that counts
              </div>
              <div className="art-progress">
                <span />
              </div>
              <div className="promise-bottom">
                <span>POWERED BY</span>
                <strong>◈ GenLayer</strong>
              </div>
            </div>
            <div className="kept-badge">
              <span>
                <ShieldCheck size={22} />
              </span>
              <div>
                <small>A PROMISE KEPT</small>
                <strong>You've got this.</strong>
              </div>
              <span className="sparkle">✧</span>
            </div>
            <div className="art-note">Little promises. Real progress.</div>
          </div>
        </section>
        <section className="stats">
          <div>
            <span className="stat-icon">
              <FileCheck2 size={19} />
            </span>
            <div>
              <strong>{configured ? total.toString() : "—"}</strong>
              <span>Pledges on studionet</span>
            </div>
          </div>
          <div>
            <span className="stat-icon">
              <Clock3 size={19} />
            </span>
            <div>
              <strong>{configured ? active.length : "—"}</strong>
              <span>In progress on this page</span>
            </div>
          </div>
          <div>
            <span className="stat-icon">
              <ShieldCheck size={19} />
            </span>
            <div>
              <strong>{configured ? kept.length : "—"}</strong>
              <span>Pledges kept on this page</span>
            </div>
          </div>
          <div>
            <span className="stat-icon">
              <Leaf size={19} />
            </span>
            <div>
              <strong>0 GEN</strong>
              <span>Platform fees</span>
            </div>
          </div>
        </section>
        {!configured && (
          <div className="setup-banner">
            <span className="setup-icon">
              <LockKeyhole size={19} />
            </span>
            <div>
              <strong>
                Your workspace is ready. Connect a contract to begin.
              </strong>
              <p>
                No studionet contract address is configured. Explore and prepare
                a pledge; transactions unlock once a contract is connected.
              </p>
            </div>
            <span className="outline-tag">NOT CONFIGURED</span>
          </div>
        )}
        {message && (
          <div
            className={`notice ${modal || detail ? "floating" : ""} ${message.error ? "error" : "success"}`}
            role="status"
          >
            <span>{message.text}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setMessage(null)}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {busy && busy !== "wallet" && (
          <div
            className={`notice ${modal || detail ? "floating" : ""}`}
            role="status"
          >
            <LoaderCircle className="spin" size={18} />
            <span>
              {hash
                ? "Transaction submitted. Waiting for AI consensus and network confirmation…"
                : "Preparing the transaction. Confirm in your wallet when prompted…"}
              {hash && (
                <small className="tx-hash">
                  Hash: {hash} · If this takes too long, refresh and check the
                  transaction before trying again.
                </small>
              )}
            </span>
          </div>
        )}
        <section className="pledges">
          <div className="section-title">
            <div>
              <div className="eyebrow muted">PROMISES IN PROGRESS</div>
              <h2>Every pledge is a new beginning.</h2>
            </div>
            <button className="secondary" onClick={() => setModal(true)}>
              <Plus size={16} />
              Create pledge
            </button>
          </div>
          <div className="list-toolbar">
            <div className="tabs">
              <button
                className={view === "all" ? "selected" : ""}
                onClick={() => setView("all")}
              >
                All pledges
              </button>
              <button
                className={view === "mine" ? "selected" : ""}
                onClick={() => setView("mine")}
              >
                My pledges
              </button>
              <button
                className={view === "beneficiary" ? "selected" : ""}
                onClick={() => setView("beneficiary")}
              >
                For my benefit
              </button>
            </div>
            <button
              className="refresh"
              disabled={loading || !configured}
              onClick={refresh}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              Refresh
            </button>
          </div>
          {loading && !items.length ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              <h3>Loading pledges from the contract…</h3>
            </div>
          ) : !visible.length ? (
            <div className="empty">
              <div className="empty-illustration">
                <FileCheck2 size={30} />
                <span>✧</span>
              </div>
              <h3>
                {view !== "all" && !account
                  ? "Connect your wallet to find your pledges"
                  : "Your next promise starts here"}
              </h3>
              <p>
                {!configured
                  ? "No on-chain data to show yet. Prepare your first goal."
                  : "No matching pledges on this page. Every small step is worth taking."}
              </p>
              <button
                onClick={() =>
                  view !== "all" && !account ? connect() : setModal(true)
                }
              >
                {view !== "all" && !account
                  ? "Connect wallet"
                  : "Prepare a pledge"}
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="pledge-grid">
              {visible.map((p) => (
                <button
                  key={p.id}
                  className="pledge-card"
                  onClick={() => setSelected(p.id)}
                >
                  <div className="card-top">
                    <span>PLEDGE #{p.id}</span>
                    <span
                      className={`status ${p.status === "RESOLVED_KEPT" ? "green" : ""}`}
                    >
                      {labels[p.status]}
                    </span>
                  </div>
                  <h3>{p.commitment_title}</h3>
                  <p className="criteria-clamp">{p.success_criteria}</p>
                  <div className="card-money">
                    <strong>
                      {formatWeiToGen(p.stake_amount)} <small>GEN</small>
                    </strong>
                    <span>{Number(p.attempts_used)}/3 submissions</span>
                  </div>
                  <div className="card-foot">
                    <span>
                      <Clock3 size={13} />
                      {remaining(p.deadline, now)}
                    </span>
                    <span>
                      View pledge
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {configured && total > 12n && (
            <div className="pagination">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous page
              </button>
              <span>Page {page + 1} · Filters apply to this page</span>
              <button
                disabled={BigInt((page + 1) * 12) >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next page
              </button>
            </div>
          )}
        </section>
        <section id="how" className="how">
          <div className="section-title">
            <div>
              <div className="eyebrow muted">FROM INTENTION TO ACTION</div>
              <h2>Three steps. One promise to yourself.</h2>
            </div>
            <span className="hand-note">You do the work. AI verifies it.</span>
          </div>
          <div className="steps">
            <article>
              <span>
                01 <LockKeyhole size={22} />
              </span>
              <h3>Make a commitment</h3>
              <p>
                Choose your goal, deadline, and stake. Your criteria are
                publicly locked from the start.
              </p>
            </article>
            <article>
              <span>
                02 <FileCheck2 size={22} />
              </span>
              <h3>Let your work speak</h3>
              <p>
                Submit public work and a source that verifies when it was
                created. You have up to three submissions.
              </p>
            </article>
            <article>
              <span>
                03 <ShieldCheck size={22} />
              </span>
              <h3>Keep your pledge, reclaim your GEN</h3>
              <p>
                AI checks every criterion. Success returns your stake; final
                failure or expiry sends it to your beneficiary.
              </p>
            </article>
          </div>
        </section>
        <div className="honesty">
          <ShieldCheck size={20} />
          <p>
            A motivation tool with transparent limits. AI can be wrong; public
            evidence and timestamps help reduce risk. Choose a beneficiary who
            can independently review your work.
          </p>
        </div>
      </main>
      <footer>
        <a className="brand" href="#">
          <ShieldCheck size={19} />
          PledgeGuard.
        </a>
        <span>Small promises. A better you.</span>
        <a href="https://studio.genlayer.com/" target="_blank" rel="noreferrer">
          Built on GenLayer
          <ArrowUpRight size={14} />
        </a>
      </footer>
      {modal && (
        <CreateModal
          account={account}
          busy={busy}
          onClose={() => setModal(false)}
          onConnect={connect}
          onCreate={transact}
        />
      )}
      {detail && (
        <DetailModal
          p={detail}
          now={now}
          account={account}
          busy={busy}
          transact={transact}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function PasteInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = true,
}) {
  const [error, setError] = useState("");
  async function paste() {
    try {
      onChange(await navigator.clipboard.readText());
      setError("");
    } catch {
      setError("Could not read the clipboard. Paste with Ctrl+V.");
    }
  }
  return (
    <label className="field">
      {label}
      <span className="input-wrap">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
        <button type="button" onClick={paste} aria-label={`Paste ${label}`}>
          <Clipboard size={15} />
          Paste
        </button>
      </span>
      {error && <small role="status">{error}</small>}
    </label>
  );
}
function Modal({ title, subtitle, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("input, button")?.focus();
    function escape(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", escape);
      previousFocus?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        ref={dialogRef}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const nodes = Array.from(
            dialogRef.current.querySelectorAll(
              "button:not(:disabled), input:not(:disabled), select, a[href], summary",
            ),
          ).filter((node) => node.getClientRects().length);
          const first = nodes[0],
            last = nodes.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow muted">PLEDGEGUARD / STUDIONET</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function CreateModal({ account, busy, onClose, onConnect, onCreate }) {
  const [kind, setKind] = useState("writing"),
    [count, setCount] = useState(1000),
    [extras, setExtras] = useState([]),
    [title, setTitle] = useState(""),
    [days, setDays] = useState("7"),
    [stake, setStake] = useState("1"),
    [beneficiary, setBeneficiary] = useState(""),
    [ack, setAck] = useState(false),
    [error, setError] = useState("");
  const cat = categories[kind],
    criteria = buildCriteria(kind, count, extras);
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!isAddress(beneficiary) || /^0x0{40}$/i.test(beneficiary))
      return setError("Enter a valid beneficiary wallet address.");
    if (beneficiary.toLowerCase() === account.toLowerCase())
      return setError("The beneficiary must be different from the pledger.");
    const value = parseGenToWei(stake);
    if (value <= 0n)
      return setError(
        "The GEN stake must be greater than zero, with up to 18 decimal places.",
      );
    const deadline =
      BigInt(Math.trunc(Date.now() / 1000)) + BigInt(days) * 86400n;
    await onCreate(
      "create_pledge",
      [beneficiary, title.trim(), criteria, deadline],
      value,
    );
  }
  return (
    <Modal
      title="Turn your goal into a pledge."
      subtitle="A clear goal. A real deadline. A little extra motivation."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label className="field">
          Pledge title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            placeholder="For example: Publish my first article about what I learned"
          />
        </label>
        <label className="field">What would you like to achieve?</label>
        <div className="category-chips">
          {Object.entries(categories).map(([key, c]) => (
            <button
              key={key}
              type="button"
              className={kind === key ? "chosen" : ""}
              onClick={() => {
                setKind(key);
                setCount(c.options[1]);
                setExtras([]);
              }}
            >
              <span>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
        <div className="criteria-builder">
          <div>
            <strong>Success criteria</strong>
            <label>
              At least{" "}
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {cat.options.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>{" "}
              {cat.unit}
            </label>
          </div>
          {cat.extras.map((item, i) => (
            <label className="checkbox" key={item}>
              <input
                type="checkbox"
                checked={extras.includes(i)}
                onChange={() =>
                  setExtras((x) =>
                    x.includes(i) ? x.filter((y) => y !== i) : [...x, i],
                  )
                }
              />
              {item}
            </label>
          ))}
          <details>
            <summary>Preview the criteria that will be locked</summary>
            <pre>{criteria}</pre>
          </details>
        </div>
        <div className="form-row">
          <label className="field">
            Deadline
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Stake (GEN)
            <input
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              required
              pattern="[0-9]+(\.[0-9]{1,18})?"
            />
          </label>
        </div>
        <div className="stake-chips">
          {["0.1", "1", "5", "10"].map((s) => (
            <button
              key={s}
              type="button"
              className={stake === s ? "chosen" : ""}
              onClick={() => setStake(s)}
            >
              {s} GEN
            </button>
          ))}
        </div>
        <PasteInput
          label="Beneficiary wallet"
          value={beneficiary}
          onChange={setBeneficiary}
          placeholder="0x… regular wallet address (EOA)"
        />
        <div className="warnings">
          <p>
            Studionet can retain attached GEN even when contract execution
            fails. Creation is simulated before signing, but this does not
            guarantee a refund if later execution fails.
          </p>
          <p>
            <LockKeyhole size={15} />
            Your stake stays locked until resolution or expiry. The criteria,
            deadline, and beneficiary cannot be changed after creation.
          </p>
          <p>
            If the pledge fails,{" "}
            <strong>
              {formatWeiToGen(parseGenToWei(stake))} GEN will be sent to{" "}
              {beneficiary || "0x…"}
            </strong>
            . Use a regular wallet address, not a contract address.
          </p>
          <p>
            Only public work created <strong>after</strong> the pledge was
            created and <strong>before</strong> its deadline counts.
          </p>
        </div>
        <label className="checkbox acknowledge">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          I understand the stake lock and accept this commitment.
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!configured && (
          <p className="form-hint">
            No contract is configured — you can prepare this form, but
            transactions are not available yet.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Maybe later
          </button>
          {!account ? (
            <button
              type="button"
              className="primary"
              disabled={!!busy}
              onClick={onConnect}
            >
              <Wallet size={16} />
              Connect wallet
            </button>
          ) : (
            <button
              className="primary"
              disabled={!configured || !ack || !!busy}
            >
              <LockKeyhole size={16} />
              {busy ? "Processing…" : "Lock GEN & create pledge"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function DetailModal({ p, now, account, busy, transact, onClose }) {
  const [evidence, setEvidence] = useState([""]),
    [reference, setReference] = useState([""]),
    [error, setError] = useState("");
  const mine = String(p.pledger).toLowerCase() === account.toLowerCase(),
    expired = now > Number(p.deadline),
    canExpire = canClaimExpiry(p, now),
    reviewTimedOut = p.status === "SUBMITTED" && canExpire,
    canSubmit =
      mine &&
      !expired &&
      Number(p.attempts_used) < 3 &&
      ["AWAITING_EVIDENCE", "DISPUTED"].includes(p.status);
  const history = (p.submission_history || [])
    .map((x) => {
      try {
        return JSON.parse(x);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  async function submit(e) {
    e.preventDefault();
    if ([...evidence, ...reference].some((u) => !safeUrl(u)))
      return setError("Every link must be a valid public HTTPS URL.");
    setError("");
    await transact("submit_evidence", [p.id, evidence, reference]);
  }
  return (
    <Modal
      title={p.commitment_title}
      subtitle={`Pledge #${p.id} · ${labels[p.status]}`}
      onClose={onClose}
    >
      <div className="detail-summary">
        <div>
          <span>STAKE</span>
          <strong>{formatWeiToGen(p.stake_amount)} GEN</strong>
        </div>
        <div>
          <span>ATTEMPTS LEFT</span>
          <strong>{3 - Number(p.attempts_used)}/3</strong>
        </div>
        <div>
          <span>TIME LEFT</span>
          <strong>{remaining(p.deadline, now)}</strong>
        </div>
      </div>
      <dl className="terms">
        <dt>Pledger</dt>
        <dd>{String(p.pledger)}</dd>
        <dt>Beneficiary</dt>
        <dd>{String(p.beneficiary)}</dd>
        <dt>Valid work window</dt>
        <dd>
          {date(p.created_at)} → {date(p.deadline)}
        </dd>
        {p.review_timeout_at !== undefined && (
          <>
            <dt>Review timeout</dt>
            <dd>
              {date(p.review_timeout_at)} · Unresolved submissions can be
              forfeited after this time.
            </dd>
          </>
        )}
      </dl>
      <h3>Locked criteria</h3>
      <pre className="locked-criteria">{p.success_criteria}</pre>
      {!p.verdict && p.verdict_reason && (
        <p className="form-hint">{p.verdict_reason}</p>
      )}
      {p.verdict && (
        <div className="verdict">
          <strong>
            {p.verdict} · Confidence {String(p.confidence)}/100
          </strong>
          <p>{p.verdict_reason}</p>
          {p.status === "AWAITING_EVIDENCE" && (
            <p>
              You have {3 - Number(p.attempts_used)} submissions left. Your
              stake remains locked.
            </p>
          )}
          {p.status === "DISPUTED" && (
            <p>
              Low confidence.{" "}
              {Number(p.attempts_used) < 3
                ? "Submit stronger evidence before the deadline."
                : "No submissions left; settlement becomes available after expiry."}
            </p>
          )}
        </div>
      )}
      <h3>Public evidence · {history.length} submissions</h3>
      {!history.length && (
        <p className="form-hint">No evidence submitted yet.</p>
      )}
      {history.map((h) => (
        <div className="history" key={h.attempt}>
          <strong>
            Attempt {h.attempt} · {date(h.submitted_at)}{" "}
            {h.verdict && `· ${h.verdict}`}
          </strong>
          <small>Deliverable</small>
          {h.evidence_urls.map((u) => (
            <Url key={u} url={u} />
          ))}
          <small>Platform timestamp source</small>
          {h.reference_urls.map((u) => (
            <Url key={u} url={u} />
          ))}
          {h.reason && (
            <p>
              {h.reason} · Confidence {h.confidence}/100
            </p>
          )}
        </div>
      ))}
      {canSubmit && (
        <form className="submit-evidence" onSubmit={submit}>
          <h3>
            {p.attempts_used > 0 ? "Resubmit evidence" : "Submit your work"}
          </h3>
          <p>
            Use GitHub commit history or an archive timestamp tied to the same
            work. A self-reported date does not prove creation time. Pages must
            be public, readable, and accessible without signing in.
          </p>
          {evidence.map((url, i) => (
            <PasteInput
              key={i}
              label={`Deliverable link ${i + 1}`}
              type="url"
              value={url}
              onChange={(value) =>
                setEvidence((v) => v.map((x, j) => (j === i ? value : x)))
              }
            />
          ))}
          {evidence.length < 3 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setEvidence((x) => [...x, ""])}
            >
              + Add deliverable link
            </button>
          )}
          {reference.map((url, i) => (
            <PasteInput
              key={i}
              label={`Timestamp reference ${i + 1}`}
              type="url"
              value={url}
              onChange={(value) =>
                setReference((v) => v.map((x, j) => (j === i ? value : x)))
              }
            />
          ))}
          {reference.length < 3 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setReference((x) => [...x, ""])}
            >
              + Add reference source
            </button>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary" disabled={!!busy}>
            Submit evidence · attempt {Number(p.attempts_used) + 1}/3
          </button>
        </form>
      )}
      {p.status === "SUBMITTED" && !reviewTimedOut && (
        <div className="action-block">
          <p>
            Anyone can request AI review. Evidence submitted on time can still
            be reviewed after the deadline.
            {p.review_timeout_at !== undefined &&
              " Review is limited to the 24-hour grace period. If URLs remain unavailable or consensus never succeeds, anyone can settle for the beneficiary after the review timeout."}
          </p>
          <button
            className="primary"
            disabled={!account || !!busy}
            onClick={() => transact("resolve_evidence", [p.id])}
          >
            <ShieldCheck size={16} />
            {busy ? "Waiting for consensus…" : "Request AI review"}
          </button>
        </div>
      )}
      {canExpire && (
        <div className="action-block">
          <p>
            {reviewTimedOut
              ? "The review grace period has expired without an agreed verdict."
              : "The deadline has passed."}{" "}
            The entire {formatWeiToGen(p.stake_amount)} GEN will be sent to{" "}
            {String(p.beneficiary)}.
          </p>
          <button
            className="primary"
            disabled={!account || !!busy}
            onClick={() => transact("claim_expired_forfeit", [p.id])}
          >
            Settle expired pledge
          </button>
        </div>
      )}
      {p.status === "PAYOUT_FAILED" && (
        <div className="action-block">
          <p>
            Payout failed. Retry sends funds to the saved recipient:{" "}
            {String(p.settle_to_pledger ? p.pledger : p.beneficiary)}. AI review
            will not run again.
          </p>
          <button
            className="primary"
            disabled={!account || !!busy}
            onClick={() => transact("retry_resolution", [p.id])}
          >
            Retry payout
          </button>
        </div>
      )}
      {!account && (
        <p className="form-hint">
          Connect your wallet in the header to sign a transaction.
        </p>
      )}
      {p.settled && (
        <p className="form-hint">
          The contract emitted a payout message. Check the child transaction to
          confirm the recipient was credited.
        </p>
      )}
    </Modal>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
