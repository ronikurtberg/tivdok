"""
הבסטה — AI Agent Bazaar for Car Buying & Selling

An autonomous negotiation arena where:
- Seller deploys a SellerAgent with their car + min acceptable price
- Buyers deploy BuyerAgents with a budget + preferences
- Agents negotiate with each other via GPT-4o-mini
- When a deal is close OR a human should know, agent flags for WhatsApp escalation
- Humans can also "walk in manually" and interact directly

Architecture:
  Arena          — holds the active session state, all agents, all events
  SellerAgent    — represents a car seller, guards their floor price
  BuyerAgent     — represents a buyer, targets best deal within budget
  ArenaEvent     — a single message/action in the arena log
  run_round()    — drives one full round of agent turns (async generator)
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncGenerator, Optional


# ── Event types ───────────────────────────────────────────────────────────────

class EventKind(str, Enum):
    AGENT_MSG    = "agent_msg"       # agent says something to the arena
    OFFER        = "offer"           # a formal price offer
    COUNTER      = "counter"        # a counter-offer
    ACCEPT       = "accept"         # deal accepted
    REJECT       = "reject"         # offer rejected
    ESCALATE     = "escalate"       # agent wants human input
    HUMAN_MSG    = "human_msg"      # real human typed a message
    SYSTEM       = "system"         # system/narrator message
    DEAL_DONE    = "deal_done"      # final deal reached


@dataclass
class ArenaEvent:
    id: str
    kind: EventKind
    actor: str                       # "seller", "buyer_<id>", "human_seller", "system"
    content: str
    price: Optional[int] = None      # set for OFFER / COUNTER / ACCEPT
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind.value,
            "actor": self.actor,
            "content": self.content,
            "price": self.price,
            "timestamp": self.timestamp,
        }


# ── Agent definitions ──────────────────────────────────────────────────────────

@dataclass
class SellerAgent:
    car: dict                        # full car dict (make, model, year, km, etc.)
    asking_price: int                # public asking price
    floor_price: int                 # private minimum — never revealed to buyers
    personality: str = "firm"       # "firm" | "flexible" | "eager"
    agent_name: str = "סוכן המוכר"

    def system_prompt(self, history_summary: str) -> str:
        car = self.car
        label = f"{car.get('year','')} {car.get('manufacturer','')} {car.get('model','')}"
        return f"""You are an AI agent representing a car SELLER in an Israeli car bazaar called הבסטה.
You are negotiating on behalf of your human seller who is NOT present — you act fully autonomously.

YOUR CAR: {label}
  Mileage: {car.get('km', 'unknown'):,} km
  Asking price: ₪{self.asking_price:,}
  Your PRIVATE floor price (never reveal this): ₪{self.floor_price:,}
  Seller personality: {self.personality}

NEGOTIATION RULES:
- Start by presenting the car confidently at the asking price
- Never go below ₪{self.floor_price:,} — reject any offer below this firmly but politely
- If personality is "firm": hold price unless buyer is serious (2+ offers)
- If personality is "flexible": willing to negotiate up to 8% off asking after first offer
- If personality is "eager": willing to negotiate up to 15% off asking immediately
- When an offer is within ₪2,000 of floor, flag ESCALATE to notify the human seller
- When a deal is reached, say ACCEPT and state the final price clearly
- Keep replies SHORT (2-3 sentences max) — this is a fast bazaar

CONVERSATION SO FAR:
{history_summary}

Respond as the seller agent. Be direct. Use ₪ for prices. Reply in Hebrew."""


@dataclass
class BuyerAgent:
    budget: int                      # max the buyer will pay
    preferences: dict               # {"make": ..., "max_km": ..., "min_year": ...}
    strategy: str = "haggler"       # "haggler" | "sniper" | "patient"
    buyer_id: str = field(default_factory=lambda: str(uuid.uuid4())[:6])
    agent_name: str = ""

    def __post_init__(self):
        if not self.agent_name:
            self.agent_name = f"סוכן קונה {self.buyer_id}"

    def system_prompt(self, car: dict, asking_price: int, history_summary: str) -> str:
        label = f"{car.get('year','')} {car.get('manufacturer','')} {car.get('model','')}"
        return f"""You are an AI agent representing a car BUYER in an Israeli car bazaar called הבסטה.
You are negotiating autonomously on behalf of your human buyer who is NOT present.

THE CAR YOU'RE NEGOTIATING FOR: {label}
  Mileage: {car.get('km', 'unknown'):,} km
  Seller asking: ₪{asking_price:,}
  YOUR MAX BUDGET (never reveal exact amount): ₪{self.budget:,}
  Your strategy: {self.strategy}

NEGOTIATION RULES:
- haggler: open 12-18% below asking, negotiate in steps of ₪2,000-3,000
- sniper: identify the lowest possible price quickly, make one strong final offer
- patient: make low offer, wait, let seller come down, don't rush
- NEVER bid above ₪{self.budget:,}
- When seller accepts or you're within ₪1,500 of budget ceiling, flag ESCALATE for your human
- When you accept a deal, say ACCEPT and state the price

CONVERSATION SO FAR:
{history_summary}

Respond as the buyer agent. Be direct. Use ₪. Reply in Hebrew."""


# ── Arena ─────────────────────────────────────────────────────────────────────

class Arena:
    def __init__(
        self,
        seller: SellerAgent,
        buyers: list[BuyerAgent],
        max_rounds: int = 12,
    ):
        self.id = str(uuid.uuid4())[:8]
        self.seller = seller
        self.buyers = buyers
        self.max_rounds = max_rounds
        self.events: list[ArenaEvent] = []
        self.round_num = 0
        self.active = True
        self.deal: Optional[dict] = None    # set when deal_done
        self.escalations: list[str] = []    # whatsapp messages queued

    def _add_event(self, kind: EventKind, actor: str, content: str, price: Optional[int] = None) -> ArenaEvent:
        ev = ArenaEvent(
            id=str(uuid.uuid4())[:8],
            kind=kind,
            actor=actor,
            content=content,
            price=price,
        )
        self.events.append(ev)
        return ev

    def _history_summary(self, last_n: int = 10) -> str:
        recent = self.events[-last_n:] if len(self.events) > last_n else self.events
        lines = []
        for ev in recent:
            price_str = f" [₪{ev.price:,}]" if ev.price else ""
            lines.append(f"[{ev.actor}] {ev.content}{price_str}")
        return "\n".join(lines) if lines else "No messages yet — the bazaar just opened."

    async def _call_gpt(self, system: str, user_msg: str, temperature: float = 0.75) -> str:
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if not openai_key:
            return "[AI unavailable — no API key configured]"
        import openai
        client = openai.AsyncOpenAI(api_key=openai_key)
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                temperature=temperature,
                max_tokens=300,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            return f"[שגיאת AI: {e}]"

    def _extract_price(self, text: str) -> Optional[int]:
        """Pull first ₪NNN,NNN from agent text."""
        import re
        matches = re.findall(r'[₪]?\s*(\d[\d,]{3,})', text.replace(",", ""))
        for m in matches:
            try:
                val = int(m.replace(",", ""))
                if 10_000 < val < 2_000_000:
                    return val
            except ValueError:
                pass
        return None

    def _classify_response(self, text: str) -> EventKind:
        t = text.lower()
        if "accept" in t or "מסכים" in t or "סגור עסקה" in t or "נסגר" in t:
            return EventKind.ACCEPT
        if "counter" in t or "מציע" in t or "הצעה נגדית" in t:
            return EventKind.COUNTER
        if "reject" in t or "לא מקבל" in t or "נמוך מדי" in t:
            return EventKind.REJECT
        if "escalate" in t or "מעדכן" in t or "להודיע" in t:
            return EventKind.ESCALATE
        return EventKind.AGENT_MSG

    async def run_round(self) -> AsyncGenerator[ArenaEvent, None]:
        """Run one negotiation round — seller speaks, then each buyer responds."""
        if not self.active:
            return

        self.round_num += 1
        summary = self._history_summary()

        # ── Seller turn ───────────────────────────────────────────────────────
        if self.round_num == 1:
            seller_prompt = f"פתח את הבסטה! הצג את הרכב שלך ואת מחיר הפתיחה בביטחון. קצר ומושך."
        else:
            seller_prompt = f"זה סבב {self.round_num}. ראית את הצעות הקונים. ענה לאחד מהם — תגובה, הצעה נגדית, קבלה או דחייה."

        seller_reply = await self._call_gpt(
            self.seller.system_prompt(summary),
            seller_prompt,
        )
        price = self._extract_price(seller_reply)
        kind = self._classify_response(seller_reply)
        ev = self._add_event(kind, "seller", seller_reply, price)
        yield ev

        if kind == EventKind.ACCEPT:
            await self._finalize_deal(price or self.seller.asking_price)
            yield self._add_event(EventKind.DEAL_DONE, "system",
                f"🎉 עסקה נסגרה! מחיר סופי: ₪{price or self.seller.asking_price:,}", price)
            self.active = False
            return

        if kind == EventKind.ESCALATE:
            msg = f"⚠️ סוכן המוכר מבקש אישורך: {seller_reply}"
            self.escalations.append(msg)
            yield self._add_event(EventKind.ESCALATE, "system", msg)

        await asyncio.sleep(0.3)

        # ── Buyer turns ───────────────────────────────────────────────────────
        for buyer in self.buyers:
            if not self.active:
                break

            if self.round_num == 1:
                buyer_prompt = "הבסטה נפתחה! הצג את עצמך והגש הצעת פתיחה לרכב. קצר וישיר."
            else:
                buyer_prompt = f"ראית את תגובת המוכר. הגב — הצע מחיר, דחה, קבל, או הגש הצעה נגדית."

            buyer_reply = await self._call_gpt(
                buyer.system_prompt(self.seller.car, self.seller.asking_price, summary),
                buyer_prompt,
            )
            price = self._extract_price(buyer_reply)
            kind = self._classify_response(buyer_reply)
            ev = self._add_event(kind, f"buyer_{buyer.buyer_id}", buyer_reply, price)
            yield ev

            if kind == EventKind.ACCEPT and price:
                if price >= self.seller.floor_price:
                    await self._finalize_deal(price)
                    yield self._add_event(EventKind.DEAL_DONE, "system",
                        f"🎉 עסקה נסגרה! קונה {buyer.agent_name} קנה ב-₪{price:,}", price)
                    self.active = False
                    return
                else:
                    yield self._add_event(EventKind.REJECT, "seller",
                        f"הצעת ₪{price:,} נמוכה מדי — המוכר לא מסכים.", price)

            if kind == EventKind.ESCALATE:
                msg = f"⚠️ {buyer.agent_name} מבקש אישורך: {buyer_reply}"
                self.escalations.append(msg)
                yield self._add_event(EventKind.ESCALATE, "system", msg)

            await asyncio.sleep(0.2)

        if self.round_num >= self.max_rounds and self.active:
            self.active = False
            yield self._add_event(EventKind.SYSTEM, "system",
                f"⏰ הבסטה נסגרת אחרי {self.max_rounds} סבבים — לא נסגרה עסקה.")

    async def _finalize_deal(self, price: int):
        self.deal = {
            "price": price,
            "car": self.seller.car,
            "timestamp": time.time(),
        }
        # Stub: real impl would send WhatsApp via Twilio/Green API
        self.escalations.append(
            f"✅ WhatsApp → המוכר: עסקה נסגרה ב-₪{price:,}! רכב: "
            f"{self.seller.car.get('year')} {self.seller.car.get('manufacturer')} {self.seller.car.get('model')}"
        )

    def inject_human_message(self, actor: str, text: str) -> ArenaEvent:
        """A real human (seller or buyer) walks into the arena and speaks."""
        return self._add_event(EventKind.HUMAN_MSG, actor, text)

    def status(self) -> dict:
        return {
            "arena_id": self.id,
            "round": self.round_num,
            "active": self.active,
            "deal": self.deal,
            "event_count": len(self.events),
            "escalations": self.escalations,
        }


# ── In-memory session store (POC — replace with Redis in prod) ───────────────

_ARENAS: dict[str, Arena] = {}


def create_arena(seller_data: dict, buyers_data: list[dict], max_rounds: int = 12) -> Arena:
    seller = SellerAgent(
        car=seller_data["car"],
        asking_price=seller_data["asking_price"],
        floor_price=seller_data.get("floor_price", int(seller_data["asking_price"] * 0.88)),
        personality=seller_data.get("personality", "flexible"),
    )
    buyers = []
    for bd in buyers_data:
        buyers.append(BuyerAgent(
            budget=bd["budget"],
            preferences=bd.get("preferences", {}),
            strategy=bd.get("strategy", "haggler"),
            agent_name=bd.get("name", ""),
        ))
    arena = Arena(seller=seller, buyers=buyers, max_rounds=max_rounds)
    _ARENAS[arena.id] = arena
    return arena


def get_arena(arena_id: str) -> Optional[Arena]:
    return _ARENAS.get(arena_id)
