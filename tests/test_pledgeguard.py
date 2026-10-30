import json
import re
import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest

START = 1793059200
STAKE = 1000000000000000001
EVIDENCE = ["https://example.com/work"]
REFERENCE = ["https://github.com/alice/work/commits/main"]


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).isoformat()


@pytest.fixture
def env(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch):
    # gltest 0.29.2 EOAProxy reads the old _vm attribute, while WASI now uses
    # thread-local get_vm(). Restore the harness alias only; contract is unmodified.
    from gltest.direct import wasi_mock
    monkeypatch.setattr(wasi_mock, "_vm", direct_vm, raising=False)
    direct_vm.warp(iso(START))
    direct_vm.sender = direct_alice
    # warp() in this runner version refreshes message but omits raw datetime.
    # Forward its own clock to the raw SDK message after every refresh.
    original_refresh = direct_vm._refresh_gl_message
    def refresh_with_clock():
        original_refresh()
        import genlayer.gl as gl
        gl.message_raw["datetime"] = direct_vm._datetime
    monkeypatch.setattr(direct_vm, "_refresh_gl_message", refresh_with_clock)
    c = direct_deploy("contracts/pledgeguard.py", sdk_version="v0.2.16")
    from genlayer import Address
    direct_alice, direct_bob, direct_charlie = [Address(x) if isinstance(x, bytes) else x for x in [direct_alice, direct_bob, direct_charlie]]
    direct_vm.sender = direct_alice
    direct_vm.deal(direct_alice, STAKE * 10)
    return SimpleNamespace(vm=direct_vm, c=c, alice=direct_alice, bob=direct_bob, stranger=direct_charlie)


def create(e, **overrides):
    args = dict(beneficiary=e.bob, commitment_title="Ship an article", success_criteria="Publish 1000 words.", deadline=START + 86400)
    args.update(overrides)
    e.vm.value = STAKE
    try:
        return e.c.create_pledge(**args)
    finally:
        e.vm.value = 0


def submit(e, pid="0"):
    e.c.submit_evidence(pid, EVIDENCE, REFERENCE)


def mocks(e, verdict="KEPT", confidence=90, raw=None):
    e.vm.clear_mocks()
    from glsim.server import RPC_METHODS
    # Exercise the real sim_installMocks handler in-process, without a network
    # deployment. The handler registers mocks on the real gltest VM.
    installed = RPC_METHODS["sim_installMocks"](None, SimpleNamespace(vm=e.vm), {
        "strict": True,
        "web_mocks": {"example.com": "Original public work created during the window", "github.com": "Platform timestamp: 2026-10-27T04:00:00+00:00"},
        "llm_mocks": {"neutral commitment adjudicator": raw if raw is not None else json.dumps(dict(verdict=verdict, confidence=confidence, reason="All criteria checked"))},
    })
    assert installed == {"llm": 1, "web": 2, "strict": True}


def state(e):
    return e.c.get_pledge("0")


def validate(e, **kwargs):
    # run_validator() does not enter nondet mode in gltest 0.29.2.
    e.vm._in_nondet = True
    try:
        return e.vm.run_validator(**kwargs)
    finally:
        e.vm._in_nondet = False


def test_kept_refunds_exact_stake(env):
    e = env; create(e); submit(e); mocks(e)
    before = dict(e.vm._balances)
    e.vm.sender = e.stranger
    e.c.resolve_evidence("0")
    assert state(e)["status"] == "RESOLVED_KEPT"
    assert state(e)["settled"]
    assert e.vm._balances[e.vm._to_bytes(e.alice)] - before[e.vm._to_bytes(e.alice)] == STAKE


def test_broken_retry_then_kept_and_full_history(env):
    e = env; create(e); submit(e); mocks(e, "BROKEN")
    before = dict(e.vm._balances)
    e.c.resolve_evidence("0")
    assert state(e)["status"] == "AWAITING_EVIDENCE"
    assert e.vm._balances == before
    submit(e); mocks(e); e.c.resolve_evidence("0")
    assert state(e)["status"] == "RESOLVED_KEPT"
    history = [json.loads(x) for x in state(e)["submission_history"]]
    assert [x["verdict"] for x in history] == ["BROKEN", "KEPT"]


def test_third_broken_forfeits_fourth_rejected(env):
    e = env; create(e)
    for _ in range(3):
        submit(e); mocks(e,"BROKEN"); e.c.resolve_evidence("0")
    assert state(e)["status"] == "RESOLVED_BROKEN"
    assert state(e)["attempts_used"] == 3
    assert e.vm._balances[e.vm._to_bytes(e.bob)] == STAKE
    with e.vm.expect_revert("Cannot submit"):
        submit(e)


def test_third_disputed_blocks_fourth_until_expiry(env):
    e = env; create(e)
    for _ in range(3):
        submit(e); mocks(e,confidence=59); e.c.resolve_evidence("0")
    with e.vm.expect_revert("Maximum number"):
        submit(e)
    e.vm.warp(iso(START+86401)); e.c.claim_expired_forfeit("0")
    assert state(e)["status"] == "EXPIRED_FORFEITED"


def test_on_time_submission_resolves_after_deadline(env):
    e = env; create(e); submit(e); e.vm.warp(iso(START+86401))
    with e.vm.expect_revert("review window has not expired"):
        e.c.claim_expired_forfeit("0")
    mocks(e,"BROKEN"); e.c.resolve_evidence("0")
    assert state(e)["status"] == "RESOLVED_BROKEN"


def test_permissionless_expiry(env):
    e = env; create(e)
    with e.vm.expect_revert("Deadline has not passed"):
        e.c.claim_expired_forfeit("0")
    e.vm.sender = e.stranger; e.vm.warp(iso(START+86401)); e.c.claim_expired_forfeit("0")
    assert state(e)["status"] == "EXPIRED_FORFEITED"
    assert e.vm._balances[e.vm._to_bytes(e.bob)] == STAKE


def test_sender_and_deadline_boundaries(env):
    e = env; create(e); e.vm.sender=e.stranger
    with e.vm.expect_revert("Only the pledger"):
        submit(e)
    e.vm.sender=e.alice; e.vm.warp(iso(START+86401))
    with e.vm.expect_revert("deadline has passed"):
        submit(e)
    e.vm.warp(iso(START+86400)); submit(e)
    assert state(e)["status"] == "SUBMITTED"


def test_low_confidence_resubmission(env):
    e = env; create(e); submit(e); mocks(e, confidence=59); e.c.resolve_evidence("0")
    assert state(e)["status"] == "DISPUTED"
    assert not state(e)["settled"]
    submit(e); mocks(e, confidence=60); e.c.resolve_evidence("0")
    assert state(e)["status"] == "RESOLVED_KEPT"


@pytest.mark.parametrize("evidence,reference", [([],REFERENCE),(EVIDENCE,[]),(["http://example.com"],REFERENCE),(EVIDENCE,REFERENCE*4)])
def test_bad_urls(env,evidence,reference):
    e=env; create(e)
    with e.vm.expect_revert():
        e.c.submit_evidence("0",evidence,reference)
    assert state(e)["attempts_used"] == 0


@pytest.mark.parametrize("overrides", [{"commitment_title":" "},{"success_criteria":""},{"deadline":START+3599},{"deadline":START+31622401}])
def test_bad_creation(env,overrides):
    with env.vm.expect_revert():
        create(env,**overrides)
    assert env.c.get_pledge_count() == 0


def test_zero_stake_and_self_beneficiary(env):
    e=env
    with e.vm.expect_revert("amount must be > 0"):
        e.c.create_pledge(e.bob,"title","criteria",START+86400)
    with e.vm.expect_revert("different nonzero"):
        create(e,beneficiary=e.alice)


@pytest.mark.parametrize("raw", ["not json","[]",'{"verdict":"MAYBE"}'])
def test_invalid_ai_response_leaves_submission_untouched(env,raw):
    e=env; create(e); submit(e); before=state(e); mocks(e,raw=raw)
    with e.vm.expect_revert():
        e.c.resolve_evidence("0")
    assert state(e) == before


def test_fetch_fail_reverts_cleanly(env):
    e=env; create(e); submit(e); before=state(e)
    # No mocks: the real test runner raises on any unmocked web call.
    with e.vm.expect_revert("Failed to fetch evidence"):
        e.c.resolve_evidence("0")
    assert state(e) == before


@pytest.mark.parametrize("mode", ["refund","broken","expired"])
def test_real_emit_exception_then_permissionless_retry(env,mode):
    e=env; create(e)
    if mode != "expired":
        submit(e); mocks(e,"KEPT" if mode == "refund" else "BROKEN")
    if mode != "refund":
        e.vm.warp(iso(START+86401))
    from gltest.direct.loader import _EOAProxy
    before=dict(e.vm._balances)
    with patch.object(_EOAProxy,"emit_transfer",side_effect=RuntimeError("recipient rejected")):
        if mode == "expired": e.c.claim_expired_forfeit("0")
        else: e.c.resolve_evidence("0")
    p=state(e)
    assert p["status"] == "PAYOUT_FAILED" and not p["settled"]
    assert p["settle_to_pledger"] == (mode == "refund")
    assert e.vm._balances == before
    e.vm.clear_mocks() # Retry must not need web or AI.
    e.vm.sender=e.stranger; e.c.retry_resolution("0")
    assert state(e)["settled"]
    recipient=e.alice if mode == "refund" else e.bob
    key=e.vm._to_bytes(recipient)
    assert e.vm._balances.get(key,0)-before.get(key,0) == STAKE
    with e.vm.expect_revert("Can only retry"):
        e.c.retry_resolution("0")


def test_immutable_terms_double_resolution_and_validator(env):
    e=env; create(e); before=state(e); submit(e); mocks(e); e.c.resolve_evidence("0")
    for key in ["pledger","beneficiary","success_criteria","stake_amount","created_at","deadline"]:
        assert state(e)[key] == before[key]
    assert validate(e)
    mocks(e,"BROKEN"); assert not validate(e)
    assert not validate(e,leader_error=RuntimeError("failed"))
    with e.vm.expect_revert("not ready"):
        e.c.resolve_evidence("0")


def test_prompt_and_confidence_parser(env):
    e=env; create(e); submit(e)
    mocks(e)
    e.vm.clear_mocks()
    e.vm.mock_web("example.com", "data"); e.vm.mock_web("github.com", "data")
    pattern = r"(?s)SECURITY RULE.*"+re.escape(iso(START))+r".*"+re.escape(iso(START+86400))+r".*BURDEN OF PROOF"
    e.vm.mock_llm(pattern,'```json\n{"verdict":"kept","confidence":200,"reason":"ok"}\n```')
    e.c.resolve_evidence("0")
    assert state(e)["confidence"] == 100


@pytest.mark.parametrize("method",["submit_evidence","resolve_evidence","claim_expired_forfeit","retry_resolution","get_pledge"])
def test_missing_pledge(env,method):
    with env.vm.expect_revert("does not exist"):
        getattr(env.c,method)("404",*([EVIDENCE,REFERENCE] if method=="submit_evidence" else []))


@pytest.mark.parametrize("duration", [3600,31622400])
def test_creation_duration_endpoints(env,duration):
    create(env,deadline=START+duration)
    assert state(env)["deadline"] == START+duration


@pytest.mark.parametrize("method",["submit_evidence","resolve_evidence","claim_expired_forfeit","retry_resolution"])
def test_other_writes_reject_accidental_value(env,method):
    create(env); env.vm.value=1
    with env.vm.expect_revert("Only create_pledge accepts"):
        getattr(env.c,method)("0",*([EVIDENCE,REFERENCE] if method=="submit_evidence" else []))
    env.vm.value=0


def test_sdk_abi_and_public_surface(env):
    from genlayer.py.get_schema import get_schema
    instance = object.__getattribute__(env.c, "_instance")
    schema = get_schema(type(instance))
    methods = schema["methods"]
    assert set(methods) == {"create_pledge", "submit_evidence", "resolve_evidence", "claim_expired_forfeit", "retry_resolution", "get_pledge", "get_pledge_count"}
    assert methods["create_pledge"]["payable"] is True
    assert all(not data.get("payable", False) for name,data in methods.items() if name != "create_pledge")
    assert schema["ctor"]["params"] == []


def test_zero_address_rejected(env):
    from genlayer import Address
    with env.vm.expect_revert("different nonzero"):
        create(env,beneficiary=Address("0x"+"0"*40))


@pytest.mark.parametrize("unavailable", ["evidence", "reference"])
@pytest.mark.parametrize("entrypoint", ["claim_expired_forfeit", "resolve_evidence"])
def test_unavailable_url_has_permissionless_deterministic_timeout(env, unavailable, entrypoint):
    e = env; create(e); submit(e); mocks(e)
    import genlayer.gl as gl
    original_render = gl.nondet.web.render
    failed_url = EVIDENCE[0] if unavailable == "evidence" else REFERENCE[0]
    def unavailable_render(url):
        if url == failed_url:
            raise RuntimeError("Page unavailable")
        return original_render(url)
    before = state(e)
    balances = dict(e.vm._balances)
    with patch.object(gl.nondet.web, "render", side_effect=unavailable_render):
        for _ in range(2):
            with e.vm.expect_revert(f"Failed to fetch {unavailable}"):
                e.c.resolve_evidence("0")
    assert state(e) == before
    assert e.vm._balances == balances
    # Neither ordinary expiry nor the exact grace boundary can bypass on-time evidence.
    for timestamp in [START + 86401, START + 86400 + 86400]:
        e.vm.warp(iso(timestamp))
        with e.vm.expect_revert("review window has not expired"):
            e.c.claim_expired_forfeit("0")
    e.vm.warp(iso(START + 86400 + 86400 + 1))
    e.vm.sender = e.stranger
    with patch.object(gl.nondet.web, "render", side_effect=AssertionError("No web allowed")), patch.object(gl.nondet, "exec_prompt", side_effect=AssertionError("No AI allowed")):
        getattr(e.c, entrypoint)("0")
    p = state(e)
    assert p["status"] == "EXPIRED_FORFEITED" and p["settled"]
    assert p["verdict"] == ""  # Expiry is not a fabricated AI BROKEN verdict.
    assert p["attempts_used"] == 1
    assert e.vm._balances[e.vm._to_bytes(e.bob)] - balances.get(e.vm._to_bytes(e.bob), 0) == STAKE
    history = json.loads(p["submission_history"][0])
    assert history["evidence_urls"] == EVIDENCE and history["reference_urls"] == REFERENCE
    assert history["settlement_intent"] == "EXPIRED_FORFEITED"
    paid_balances = dict(e.vm._balances)
    with e.vm.expect_revert():
        getattr(e.c, entrypoint)("0")
    assert e.vm._balances == paid_balances


def test_submitted_timeout_emission_failure_preserves_intent_for_retry(env):
    e = env; create(e); submit(e)
    from gltest.direct.loader import _EOAProxy
    e.vm.warp(iso(START + 172801)); e.vm.sender = e.stranger
    with patch.object(_EOAProxy, "emit_transfer", side_effect=RuntimeError("rejected")):
        e.c.claim_expired_forfeit("0")
    assert state(e)["status"] == "PAYOUT_FAILED"
    assert state(e)["settle_success_status"] == "EXPIRED_FORFEITED"
    assert state(e)["settle_to_pledger"] is False
    e.c.retry_resolution("0")
    assert state(e)["status"] == "EXPIRED_FORFEITED"
    assert e.vm._balances[e.vm._to_bytes(e.bob)] == STAKE


@pytest.mark.parametrize("confidence", [59, 60, 100])
def test_review_allowed_at_exact_grace_boundary(env, confidence):
    e = env; create(e); submit(e); mocks(e, "KEPT", confidence)
    assert state(e)["review_timeout_at"] == START + 172800
    e.vm.warp(iso(START + 172800)); e.c.resolve_evidence("0")
    assert state(e)["status"] == ("DISPUTED" if confidence < 60 else "RESOLVED_KEPT")


@pytest.mark.parametrize("verdict", ["KEPT", "BROKEN"])
@pytest.mark.parametrize("leader_confidence, validator_confidence, agrees", [
    (59, 60, False), (60, 59, False), (0, 100, False),
    (60, 100, True), (100, 60, True), (0, 59, True),
])
def test_validator_compares_exact_verdict_and_confidence_gate(env, verdict, leader_confidence, validator_confidence, agrees):
    e = env; create(e); submit(e); mocks(e, verdict, leader_confidence)
    e.c.resolve_evidence("0")
    mocks(e, verdict, validator_confidence)
    assert validate(e) is agrees


@pytest.mark.parametrize("leader_verdict, validator_verdict", [("KEPT", "BROKEN"), ("BROKEN", "KEPT")])
def test_validator_rejects_different_verdict_even_with_same_gate(env, leader_verdict, validator_verdict):
    e = env; create(e); submit(e); mocks(e, leader_verdict, 90)
    e.c.resolve_evidence("0")
    mocks(e, validator_verdict, 90)
    assert validate(e) is False


@pytest.mark.parametrize("disagreement", ["confidence", "verdict", "reference"])
@pytest.mark.parametrize("leader_verdict", ["KEPT", "BROKEN"])
def test_rejected_consensus_keeps_state_and_money_then_timeout_recovers(env, disagreement, leader_verdict):
    e = env; create(e)
    # At the final attempt either confident outcome would release funds, to
    # different recipients. Disagreement must block both payout directions.
    for _ in range(2):
        submit(e); mocks(e, "BROKEN", 90); e.c.resolve_evidence("0")
    submit(e); mocks(e, leader_verdict, 90)
    import genlayer.gl as gl
    before = state(e); balances = dict(e.vm._balances)
    def require_consensus(leader_fn, validator_fn):
        e.vm._in_nondet = True
        try:
            result = leader_fn()
            if disagreement == "confidence":
                mocks(e, leader_verdict, 59)
            elif disagreement == "verdict":
                mocks(e, "BROKEN" if leader_verdict == "KEPT" else "KEPT", 90)
            else:
                e.vm.clear_mocks()
                e.vm.mock_web("example.com", "data")  # Reference unavailable to validator.
            if not validator_fn(gl.vm.Return(calldata=result)):
                raise gl.vm.UserError("Validator rejected settlement decision")
            return result
        finally:
            e.vm._in_nondet = False
    with patch.object(gl.vm, "run_nondet", side_effect=require_consensus):
        with e.vm.expect_revert("Validator rejected"):
            e.c.resolve_evidence("0")
    assert state(e) == before and e.vm._balances == balances
    e.vm.clear_mocks(); e.vm.warp(iso(START + 172801))
    e.c.claim_expired_forfeit("0")
    assert state(e)["status"] == "EXPIRED_FORFEITED"


def test_invalid_json_submission_also_has_timeout_path(env):
    e = env; create(e); submit(e); mocks(e, raw="not json")
    with e.vm.expect_revert("Invalid LLM verdict"):
        e.c.resolve_evidence("0")
    e.vm.warp(iso(START + 172801)); e.vm.sender = e.stranger
    e.c.claim_expired_forfeit("0")
    assert state(e)["status"] == "EXPIRED_FORFEITED"
