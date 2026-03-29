"""Tests for הבסטה — AI Agent Bazaar (habasta.py + API endpoints)."""
from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from car_seller.habasta import (
    Arena,
    ArenaEvent,
    BuyerAgent,
    EventKind,
    SellerAgent,
    create_arena,
    get_arena,
    _ARENAS,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_car_dict():
    return {
        "manufacturer": "Skoda",
        "model": "Octavia",
        "year": 2018,
        "km": 87000,
    }


@pytest.fixture
def seller(sample_car_dict):
    return SellerAgent(
        car=sample_car_dict,
        asking_price=95000,
        floor_price=84000,
        personality="flexible",
    )


@pytest.fixture
def buyer_haggler():
    return BuyerAgent(budget=90000, preferences={}, strategy="haggler", agent_name="קונה א")


@pytest.fixture
def buyer_sniper():
    return BuyerAgent(budget=88000, preferences={}, strategy="sniper", agent_name="קונה ב")


@pytest.fixture
def arena(seller, buyer_haggler):
    return Arena(seller=seller, buyers=[buyer_haggler], max_rounds=5)


@pytest.fixture
def arena_two_buyers(seller, buyer_haggler, buyer_sniper):
    return Arena(seller=seller, buyers=[buyer_haggler, buyer_sniper], max_rounds=6)


# ── SellerAgent ───────────────────────────────────────────────────────────────

class TestSellerAgent:
    def test_system_prompt_contains_asking_price(self, seller):
        prompt = seller.system_prompt("no history yet")
        assert "95,000" in prompt or "95000" in prompt

    def test_system_prompt_contains_floor_price(self, seller):
        prompt = seller.system_prompt("no history yet")
        assert "84,000" in prompt or "84000" in prompt

    def test_system_prompt_contains_car_label(self, seller):
        prompt = seller.system_prompt("no history yet")
        assert "Skoda" in prompt
        assert "Octavia" in prompt

    def test_system_prompt_contains_personality(self, seller):
        prompt = seller.system_prompt("history")
        assert "flexible" in prompt

    def test_system_prompt_contains_history(self, seller):
        prompt = seller.system_prompt("buyer offered ₪80,000")
        assert "buyer offered" in prompt

    def test_floor_price_never_revealed_instruction_present(self, seller):
        prompt = seller.system_prompt("")
        assert "never reveal" in prompt.lower() or "never" in prompt.lower()

    def test_default_agent_name(self, sample_car_dict):
        agent = SellerAgent(car=sample_car_dict, asking_price=90000, floor_price=80000)
        assert agent.agent_name  # non-empty


# ── BuyerAgent ────────────────────────────────────────────────────────────────

class TestBuyerAgent:
    def test_auto_buyer_id_generated(self):
        b = BuyerAgent(budget=80000, preferences={})
        assert b.buyer_id
        assert len(b.buyer_id) == 6

    def test_auto_agent_name_generated(self):
        b = BuyerAgent(budget=80000, preferences={})
        assert b.agent_name  # non-empty

    def test_custom_name_preserved(self, buyer_haggler):
        assert buyer_haggler.agent_name == "קונה א"

    def test_system_prompt_contains_budget(self, buyer_haggler, sample_car_dict):
        prompt = buyer_haggler.system_prompt(sample_car_dict, 95000, "")
        assert "90,000" in prompt or "90000" in prompt

    def test_system_prompt_contains_strategy(self, buyer_sniper, sample_car_dict):
        prompt = buyer_sniper.system_prompt(sample_car_dict, 95000, "")
        assert "sniper" in prompt

    def test_system_prompt_contains_asking_price(self, buyer_haggler, sample_car_dict):
        prompt = buyer_haggler.system_prompt(sample_car_dict, 95000, "")
        assert "95,000" in prompt or "95000" in prompt

    def test_system_prompt_contains_history(self, buyer_haggler, sample_car_dict):
        prompt = buyer_haggler.system_prompt(sample_car_dict, 95000, "seller said ₪93,000")
        assert "seller said" in prompt


# ── ArenaEvent ────────────────────────────────────────────────────────────────

class TestArenaEvent:
    def test_to_dict_has_required_keys(self):
        ev = ArenaEvent(
            id="abc123",
            kind=EventKind.OFFER,
            actor="seller",
            content="מציע ₪90,000",
            price=90000,
            timestamp=time.time(),
        )
        d = ev.to_dict()
        assert d["id"] == "abc123"
        assert d["kind"] == "offer"
        assert d["actor"] == "seller"
        assert d["price"] == 90000
        assert "timestamp" in d

    def test_to_dict_price_none_when_not_set(self):
        ev = ArenaEvent(id="x", kind=EventKind.SYSTEM, actor="system", content="hello")
        assert ev.to_dict()["price"] is None

    def test_event_kind_values(self):
        assert EventKind.OFFER.value == "offer"
        assert EventKind.ACCEPT.value == "accept"
        assert EventKind.REJECT.value == "reject"
        assert EventKind.ESCALATE.value == "escalate"
        assert EventKind.DEAL_DONE.value == "deal_done"
        assert EventKind.HUMAN_MSG.value == "human_msg"


# ── Arena internals ───────────────────────────────────────────────────────────

class TestArenaInternals:
    def test_initial_state(self, arena):
        assert arena.active is True
        assert arena.round_num == 0
        assert arena.deal is None
        assert arena.events == []
        assert arena.escalations == []

    def test_add_event_appended(self, arena):
        ev = arena._add_event(EventKind.SYSTEM, "system", "hello")
        assert ev in arena.events
        assert len(arena.events) == 1

    def test_add_event_with_price(self, arena):
        ev = arena._add_event(EventKind.OFFER, "seller", "₪90,000", price=90000)
        assert ev.price == 90000

    def test_history_summary_empty(self, arena):
        summary = arena._history_summary()
        assert "No messages" in summary or summary == "No messages yet — the bazaar just opened."

    def test_history_summary_shows_recent_events(self, arena):
        arena._add_event(EventKind.AGENT_MSG, "seller", "שלום עולם")
        summary = arena._history_summary()
        assert "seller" in summary
        assert "שלום עולם" in summary

    def test_history_summary_truncated_to_last_n(self, arena):
        for i in range(20):
            arena._add_event(EventKind.AGENT_MSG, "seller", f"msg {i}")
        summary = arena._history_summary(last_n=5)
        assert "msg 19" in summary
        assert "msg 0" not in summary

    def test_history_summary_price_included(self, arena):
        arena._add_event(EventKind.OFFER, "seller", "הצעה", price=92000)
        summary = arena._history_summary()
        assert "92,000" in summary or "92000" in summary

    def test_inject_human_message(self, arena):
        ev = arena.inject_human_message("human_seller", "אני רוצה ₪93,000")
        assert ev.kind == EventKind.HUMAN_MSG
        assert ev.actor == "human_seller"
        assert "93,000" in ev.content
        assert ev in arena.events

    def test_status_dict(self, arena):
        s = arena.status()
        assert "arena_id" in s
        assert s["round"] == 0
        assert s["active"] is True
        assert s["deal"] is None
        assert isinstance(s["escalations"], list)

    def test_arena_id_non_empty(self, arena):
        assert arena.id and len(arena.id) == 8

    def test_extract_price_shekel_sign(self, arena):
        assert arena._extract_price("מציע ₪85,000 לרכב") == 85000

    def test_extract_price_plain_number(self, arena):
        assert arena._extract_price("הצעה של 90000 שקל") == 90000

    def test_extract_price_no_match_returns_none(self, arena):
        assert arena._extract_price("אין מחיר כאן") is None

    def test_extract_price_ignores_small_numbers(self, arena):
        assert arena._extract_price("רכב עם 4 דלתות ו-150 כ״ס") is None

    def test_classify_response_accept(self, arena):
        assert arena._classify_response("אני מסכים לעסקה") == EventKind.ACCEPT

    def test_classify_response_reject(self, arena):
        assert arena._classify_response("לא מקבל את ההצעה הנמוכה") == EventKind.REJECT

    def test_classify_response_escalate(self, arena):
        assert arena._classify_response("מעדכן את הלקוח שלי") == EventKind.ESCALATE

    def test_classify_response_default_agent_msg(self, arena):
        assert arena._classify_response("יש לי הצעה מעניינת") == EventKind.AGENT_MSG


# ── Arena.run_round (mocked GPT) ──────────────────────────────────────────────

class TestArenaRunRound:
    def _mock_gpt(self, reply: str):
        """Patch _call_gpt to return a fixed reply."""
        return patch.object(Arena, "_call_gpt", new=AsyncMock(return_value=reply))

    def test_run_round_increments_round_num(self, arena):
        with self._mock_gpt("מציע ₪90,000 לרכב"):
            events = asyncio.get_event_loop().run_until_complete(
                self._collect_events(arena)
            )
        assert arena.round_num == 1

    def test_run_round_yields_events(self, arena):
        with self._mock_gpt("מציע ₪92,000"):
            events = asyncio.get_event_loop().run_until_complete(
                self._collect_events(arena)
            )
        assert len(events) >= 2  # at least seller + buyer

    def test_run_round_seller_goes_first(self, arena):
        with self._mock_gpt("פותח את הבסטה ב-₪95,000"):
            events = asyncio.get_event_loop().run_until_complete(
                self._collect_events(arena)
            )
        assert events[0].actor == "seller"

    def test_run_round_buyer_responds(self, arena):
        with self._mock_gpt("מציע ₪82,000"):
            events = asyncio.get_event_loop().run_until_complete(
                self._collect_events(arena)
            )
        buyer_events = [e for e in events if e.actor.startswith("buyer_")]
        assert len(buyer_events) >= 1

    def test_run_round_deal_detected_on_accept_above_floor(self, seller, buyer_haggler):
        arena = Arena(seller=seller, buyers=[buyer_haggler], max_rounds=5)
        with self._mock_gpt("אני מסכים לעסקה ב-₪88,000 ACCEPT"):
            events = asyncio.get_event_loop().run_until_complete(
                self._collect_events(arena)
            )
        deal_events = [e for e in events if e.kind == EventKind.DEAL_DONE]
        assert len(deal_events) >= 1
        assert arena.active is False

    def test_run_round_deal_rejected_below_floor(self, seller, buyer_haggler):
        # Floor is 84000. Seller gets a neutral reply; buyer "accepts" at 70000 (below floor).
        # Arena should emit a REJECT and NOT a deal_done.
        arena = Arena(seller=seller, buyers=[buyer_haggler], max_rounds=5)
        seller_reply = "המחיר שלי הוא ₪95,000 ואני מחכה להצעות רציניות."
        buyer_reply  = "אני מסכים ACCEPT ₪70,000"

        call_count = [0]
        async def side_effect(_self, system, user_msg, **kw):
            call_count[0] += 1
            return seller_reply if call_count[0] == 1 else buyer_reply

        with patch.object(Arena, "_call_gpt", new=side_effect):
            events = asyncio.get_event_loop().run_until_complete(
                self._collect_events(arena)
            )
        reject_events = [e for e in events if e.kind == EventKind.REJECT]
        deal_events   = [e for e in events if e.kind == EventKind.DEAL_DONE]
        assert len(deal_events) == 0, "below-floor offer should not close a deal"
        assert len(reject_events) >= 1, "below-floor offer should produce a REJECT event"

    def test_run_round_escalation_appended(self, arena):
        with self._mock_gpt("מעדכן את הלקוח שלי על ההצעה"):
            asyncio.get_event_loop().run_until_complete(self._collect_events(arena))
        # escalation events emitted
        escalate_events = [e for e in arena.events if e.kind == EventKind.ESCALATE]
        assert len(escalate_events) >= 1

    def test_max_rounds_closes_arena(self, seller, buyer_haggler):
        arena = Arena(seller=seller, buyers=[buyer_haggler], max_rounds=2)
        with self._mock_gpt("מציע ₪90,000"):
            for _ in range(3):
                if arena.active:
                    asyncio.get_event_loop().run_until_complete(self._collect_events(arena))
        assert not arena.active

    def test_two_buyers_both_get_turns(self, arena_two_buyers):
        with self._mock_gpt("מציע ₪88,000"):
            events = asyncio.get_event_loop().run_until_complete(
                self._collect_events(arena_two_buyers)
            )
        buyer_actors = {e.actor for e in events if e.actor.startswith("buyer_")}
        assert len(buyer_actors) == 2

    async def _collect_events(self, arena: Arena) -> list[ArenaEvent]:
        collected = []
        async for ev in arena.run_round():
            collected.append(ev)
        return collected


# ── Arena._finalize_deal ──────────────────────────────────────────────────────

class TestArenaFinalizeDeal:
    def test_finalize_sets_deal(self, arena):
        asyncio.get_event_loop().run_until_complete(arena._finalize_deal(89000))
        assert arena.deal is not None
        assert arena.deal["price"] == 89000

    def test_finalize_adds_whatsapp_escalation(self, arena):
        asyncio.get_event_loop().run_until_complete(arena._finalize_deal(89000))
        assert len(arena.escalations) == 1
        assert "89,000" in arena.escalations[0] or "89000" in arena.escalations[0]

    def test_finalize_includes_car_in_deal(self, arena):
        asyncio.get_event_loop().run_until_complete(arena._finalize_deal(89000))
        assert arena.deal["car"]["manufacturer"] == "Skoda"


# ── create_arena / get_arena ─────────────────────────────────────────────────

class TestArenaStore:
    def test_create_arena_returns_arena(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 95000},
            buyers_data=[{"budget": 85000}],
        )
        assert isinstance(arena, Arena)

    def test_create_arena_sets_floor_price_default(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 100000},
            buyers_data=[{"budget": 85000}],
        )
        assert arena.seller.floor_price == int(100000 * 0.88)

    def test_create_arena_custom_floor_price(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 100000, "floor_price": 90000},
            buyers_data=[{"budget": 85000}],
        )
        assert arena.seller.floor_price == 90000

    def test_create_arena_multiple_buyers(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 95000},
            buyers_data=[
                {"budget": 85000, "strategy": "haggler"},
                {"budget": 80000, "strategy": "sniper"},
            ],
        )
        assert len(arena.buyers) == 2

    def test_create_arena_buyer_strategy_preserved(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 95000},
            buyers_data=[{"budget": 85000, "strategy": "patient"}],
        )
        assert arena.buyers[0].strategy == "patient"

    def test_create_arena_stored_in_registry(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 95000},
            buyers_data=[{"budget": 85000}],
        )
        assert get_arena(arena.id) is arena

    def test_get_arena_unknown_id_returns_none(self):
        assert get_arena("nonexistent-id-xyz") is None

    def test_create_arena_max_rounds_respected(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 95000},
            buyers_data=[{"budget": 85000}],
            max_rounds=3,
        )
        assert arena.max_rounds == 3

    def test_create_arena_seller_personality_preserved(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 95000, "personality": "firm"},
            buyers_data=[{"budget": 85000}],
        )
        assert arena.seller.personality == "firm"

    def test_create_arena_buyer_name_preserved(self, sample_car_dict):
        arena = create_arena(
            seller_data={"car": sample_car_dict, "asking_price": 95000},
            buyers_data=[{"budget": 85000, "name": "קונה VIP"}],
        )
        assert arena.buyers[0].agent_name == "קונה VIP"


# ── Habasta API endpoints ─────────────────────────────────────────────────────

class TestHabastaCreateEndpoint:
    def _payload(self, asking=95000, floor=84000, buyers=None):
        return {
            "seller": {
                "car": {"manufacturer": "Skoda", "model": "Octavia", "year": 2018, "km": 87000},
                "asking_price": asking,
                "floor_price": floor,
                "personality": "flexible",
            },
            "buyers": buyers or [{"budget": 85000, "strategy": "haggler", "name": "קונה א"}],
            "max_rounds": 6,
        }

    def test_create_returns_200(self, api_client):
        resp = api_client.post("/api/habasta/create", json=self._payload())
        assert resp.status_code == 200

    def test_create_returns_arena_id(self, api_client):
        resp = api_client.post("/api/habasta/create", json=self._payload())
        data = resp.json()
        assert "arena_id" in data
        assert len(data["arena_id"]) == 8

    def test_create_returns_status(self, api_client):
        resp = api_client.post("/api/habasta/create", json=self._payload())
        assert "status" in resp.json()

    def test_create_status_active(self, api_client):
        resp = api_client.post("/api/habasta/create", json=self._payload())
        assert resp.json()["status"]["active"] is True

    def test_create_multiple_buyers(self, api_client):
        payload = self._payload(buyers=[
            {"budget": 85000, "strategy": "haggler"},
            {"budget": 80000, "strategy": "sniper"},
        ])
        resp = api_client.post("/api/habasta/create", json=payload)
        assert resp.status_code == 200

    def test_create_missing_seller_raises_422(self, api_client):
        resp = api_client.post("/api/habasta/create", json={"buyers": [], "max_rounds": 5})
        assert resp.status_code == 422

    def test_create_missing_buyers_raises_422(self, api_client):
        resp = api_client.post("/api/habasta/create", json={"seller": {}, "max_rounds": 5})
        assert resp.status_code == 422


class TestHabastaStatusEndpoint:
    def _create(self, api_client):
        resp = api_client.post("/api/habasta/create", json={
            "seller": {
                "car": {"manufacturer": "Toyota", "model": "Corolla", "year": 2020, "km": 50000},
                "asking_price": 80000,
            },
            "buyers": [{"budget": 72000}],
            "max_rounds": 4,
        })
        return resp.json()["arena_id"]

    def test_status_returns_200(self, api_client):
        arena_id = self._create(api_client)
        resp = api_client.get(f"/api/habasta/{arena_id}/status")
        assert resp.status_code == 200

    def test_status_has_events_list(self, api_client):
        arena_id = self._create(api_client)
        data = api_client.get(f"/api/habasta/{arena_id}/status").json()
        assert "events" in data
        assert isinstance(data["events"], list)

    def test_status_has_status_block(self, api_client):
        arena_id = self._create(api_client)
        data = api_client.get(f"/api/habasta/{arena_id}/status").json()
        assert "status" in data
        assert "active" in data["status"]

    def test_status_unknown_arena_returns_404(self, api_client):
        resp = api_client.get("/api/habasta/doesnotexist/status")
        assert resp.status_code == 404


class TestHabastaHumanMessageEndpoint:
    def _create(self, api_client):
        resp = api_client.post("/api/habasta/create", json={
            "seller": {
                "car": {"manufacturer": "Kia", "model": "Sportage", "year": 2021, "km": 40000},
                "asking_price": 120000,
            },
            "buyers": [{"budget": 108000}],
            "max_rounds": 5,
        })
        return resp.json()["arena_id"]

    def test_human_message_returns_200(self, api_client):
        arena_id = self._create(api_client)
        resp = api_client.post(
            f"/api/habasta/{arena_id}/human-message",
            json={"actor": "human_seller", "text": "אני מוכן לרדת ל-₪115,000"},
        )
        assert resp.status_code == 200

    def test_human_message_returns_event(self, api_client):
        arena_id = self._create(api_client)
        resp = api_client.post(
            f"/api/habasta/{arena_id}/human-message",
            json={"actor": "human_seller", "text": "הצעה סופית: ₪118,000"},
        )
        data = resp.json()
        assert "event" in data
        assert data["event"]["kind"] == "human_msg"
        assert data["event"]["actor"] == "human_seller"

    def test_human_message_event_in_arena_log(self, api_client):
        arena_id = self._create(api_client)
        api_client.post(
            f"/api/habasta/{arena_id}/human-message",
            json={"actor": "human_buyer", "text": "מוכן לשלם ₪110,000"},
        )
        status = api_client.get(f"/api/habasta/{arena_id}/status").json()
        kinds = [e["kind"] for e in status["events"]]
        assert "human_msg" in kinds

    def test_human_message_unknown_arena_returns_404(self, api_client):
        resp = api_client.post(
            "/api/habasta/xyz-bad-id/human-message",
            json={"actor": "human_seller", "text": "test"},
        )
        assert resp.status_code == 404

    def test_human_buyer_actor_accepted(self, api_client):
        arena_id = self._create(api_client)
        resp = api_client.post(
            f"/api/habasta/{arena_id}/human-message",
            json={"actor": "human_buyer", "text": "מציע ₪105,000"},
        )
        assert resp.json()["event"]["actor"] == "human_buyer"
