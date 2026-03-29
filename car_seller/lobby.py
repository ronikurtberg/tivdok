"""
הבסטה Lobby — dealer agents standing in the bazaar, buyers walk up and negotiate.

Each DealerAgent has a rich Israeli persona. A buyer (human or AI) opens a
LobbySession with one dealer and they negotiate 1-on-1 via GPT.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from car_seller.habasta import ArenaEvent, EventKind


# ── Dealer personas ────────────────────────────────────────────────────────────

DEALER_PERSONAS: list[dict] = [
    {
        "id": "yossi",
        "name": "יוסי כהן",
        "title": "סוחר רכב ותיק — פתח תקווה",
        "avatar": "👨‍💼",
        "age": 54,
        "city": "פתח תקווה",
        "years_exp": 27,
        "style": "pushy",
        "catchphrase": "יש לי קונה אחד שמחכה, אבל אני נותן לך צ'אנס ראשון.",
        "traits": [
            "לא מוריד מחיר בסיבב הראשון — לעולם לא",
            "תמיד מזכיר שיש לו 'עוד קונה מחר'",
            "מדגיש כמה הרכב עבר בדיקה ומוכן",
            "קצת קשוח אבל הוגן בסוף",
        ],
        "personality_prompt": (
            "You are Yossi Cohen, 54, a veteran car dealer from Petah Tikva with 27 years experience. "
            "You are confident, slightly pushy, and always mention you have another buyer waiting. "
            "You NEVER lower the price in the first round. You speak in warm but firm Israeli dealer style. "
            "You love saying 'יש לי קונה מחר' and 'הרכב הזה שווה כל שקל'. "
            "After 2 serious offers you start to budge — but never more than 6%. "
            "When close to deal say ACCEPT. Always reply in casual Israeli Hebrew, max 3 sentences."
        ),
    },
    {
        "id": "miri",
        "name": "מירי לוי",
        "title": "מוכרת פרטית — צפון תל אביב",
        "avatar": "👩‍💻",
        "age": 41,
        "city": "תל אביב",
        "years_exp": 0,
        "style": "confident",
        "catchphrase": "הרכב שלי במצב מושלם. רק עיניי ראו אותו.",
        "traits": [
            "מאוד בטוחה בעצמה ובמחיר",
            "הרכב 'כמו חדש' — כל שריטה מוכחשת",
            "לא ממהרת — יכולה לחכות לקונה הנכון",
            "מוכנה להוריד עד 5% אם הקונה מוכיח רצינות",
        ],
        "personality_prompt": (
            "You are Miri Levy, 41, a private seller from North Tel Aviv. This is your personal car "
            "maintained meticulously. You are very confident — the car is in perfect condition and you know it. "
            "You are NOT in a rush. You politely but firmly reject low offers. "
            "You occasionally hint how many people already called about the car. "
            "You will budge up to 5% after showing genuine interest. "
            "When close to deal say ACCEPT. Reply in polished modern Hebrew, max 3 sentences."
        ),
    },
    {
        "id": "jacky",
        "name": "ג'קי אזולאי",
        "title": "סוחר — חדרה",
        "avatar": "🕶️",
        "age": 38,
        "city": "חדרה",
        "years_exp": 12,
        "style": "pressure",
        "catchphrase": "אני לא משחק משחקים. מחר הרכב הזה לא פה.",
        "traits": [
            "מאסטר של לחץ — 'יש עוד אחד מגיע'",
            "עושה הכל במהירות — לא אוהב לחכות",
            "מציע 'הצעות מיוחדות' שנגמרות תוך דקות",
            "בסוף מוריד יותר מכולם — אבל רק אם הקונה מחזיק חזק",
        ],
        "personality_prompt": (
            "You are Jacky Azoulay, 38, a car dealer from Hadera. You use pressure tactics — "
            "always mention time pressure, other buyers, limited offers. You speak fast and energetically. "
            "You create urgency: 'this offer expires in 10 minutes'. "
            "You actually have the most room to negotiate but hide it well. "
            "You'll drop up to 10% if buyer holds firm across 3+ rounds. "
            "When close to deal say ACCEPT. Reply in energetic street-level Israeli Hebrew, max 3 sentences."
        ),
    },
    {
        "id": "david",
        "name": "דוד שפירא",
        "title": "מוכר פרטי — ראשון לציון",
        "avatar": "👴",
        "age": 68,
        "city": "ראשון לציון",
        "years_exp": 0,
        "style": "naive",
        "catchphrase": "אני לא יודע הרבה על מחירים, אבל הרכב היה שלי 12 שנה...",
        "traits": [
            "מוכר לראשונה — קצת מבולבל",
            "מאוד הוגן ולא ינסה לרמות",
            "יתרגש ויוריד מחיר יותר מדי אם הקונה ידחף",
            "מספר סיפורים על הרכב שלו",
        ],
        "personality_prompt": (
            "You are David Shapira, 68, a retiree from Rishon LeZion selling your personal car for the "
            "first time in your life. You are honest, slightly nervous, and don't fully understand market prices. "
            "You share emotional stories about the car — trips with grandchildren, long drives. "
            "You are easy to negotiate with and will drop price if buyer is kind and patient. "
            "You can drop up to 12% — you just want a good person to take care of the car. "
            "When you agree say ACCEPT warmly. Reply in warm, slightly old-fashioned Hebrew, max 3 sentences."
        ),
    },
    {
        "id": "rami",
        "name": "ראמי ביטון",
        "title": "מנהל מגרש — באר שבע",
        "avatar": "🦁",
        "age": 45,
        "city": "באר שבע",
        "years_exp": 18,
        "style": "loud",
        "catchphrase": "אחי, תגיד מחיר רציני ונסגור. אני לא בא לבזבז זמן.",
        "traits": [
            "קולני ולא סובל בלוף",
            "דירקט מאוד — שואל 'מה המחיר שלך' ישר",
            "יכול לנהל משא ומתן עם כמה קונים בו זמנית",
            "מכבד קונה שבא עם מחיר רציני ומוכן לסגור",
        ],
        "personality_prompt": (
            "You are Rami Biton, 45, the manager of a large car lot in Beer Sheva. "
            "You are loud, direct, no-nonsense. You hate time-wasters. "
            "You immediately ask the buyer what their real price is. "
            "You respect a buyer who comes with a firm serious offer. "
            "You'll match a serious offer quickly — you close 5 deals a day. "
            "You can drop up to 8% for a quick close. "
            "When you agree say ACCEPT. Reply in very direct, slightly rough Israeli Hebrew, max 3 sentences."
        ),
    },
]

_PERSONA_MAP: dict[str, dict] = {p["id"]: p for p in DEALER_PERSONAS}


# ── DealerAgent ────────────────────────────────────────────────────────────────

@dataclass
class DealerAgent:
    persona_id: str
    car: dict
    asking_price: int
    floor_price: int
    session_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    dealer_status: str = "waiting"    # "waiting" | "in_session" | "done"
    deal: Optional[dict] = None

    @property
    def persona(self) -> dict:
        return _PERSONA_MAP.get(self.persona_id, DEALER_PERSONAS[0])

    def lobby_card(self) -> dict:
        p = self.persona
        c = self.car
        return {
            "session_id": self.session_id,
            "persona_id": self.persona_id,
            "name": p["name"],
            "title": p["title"],
            "avatar": p["avatar"],
            "age": p["age"],
            "city": p["city"],
            "years_exp": p["years_exp"],
            "style": p["style"],
            "catchphrase": p["catchphrase"],
            "traits": p["traits"],
            "car_label": f"{c.get('year','')} {c.get('manufacturer','')} {c.get('model','')}".strip(),
            "car_km": c.get("km", 0),
            "asking_price": self.asking_price,
            "dealer_status": self.dealer_status,
        }

    def system_prompt(self, history_summary: str) -> str:
        p = self.persona
        c = self.car
        label = f"{c.get('year','')} {c.get('manufacturer','')} {c.get('model','')}".strip()
        return (
            f"{p['personality_prompt']}\n\n"
            f"THE CAR YOU ARE SELLING:\n"
            f"  {label}\n"
            f"  Mileage: {c.get('km', 0):,} km\n"
            f"  Asking price: \u20aa{self.asking_price:,}\n"
            f"  Your private floor (NEVER reveal): \u20aa{self.floor_price:,}\n\n"
            f"RULES:\n"
            f"- Never go below \u20aa{self.floor_price:,}\n"
            f"- When offer is within \u20aa2,000 of floor, say ESCALATE\n"
            f"- When you accept, say ACCEPT and state the final price clearly\n\n"
            f"CONVERSATION SO FAR:\n{history_summary}"
        )


# ── LobbySession ───────────────────────────────────────────────────────────────

@dataclass
class LobbySession:
    dealer: DealerAgent
    buyer_name: str = "קונה"
    buyer_budget: Optional[int] = None
    session_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    messages: list[dict] = field(default_factory=list)   # {role, actor, text, ts, price, kind}
    active: bool = True
    deal: Optional[dict] = None
    escalations: list[str] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)

    def _history_summary(self, last_n: int = 12) -> str:
        recent = self.messages[-last_n:]
        if not recent:
            return "No messages yet — session just opened."
        lines = []
        for m in recent:
            price_str = f" [\u20aa{m['price']:,}]" if m.get("price") else ""
            lines.append(f"[{m['actor']}] {m['text']}{price_str}")
        return "\n".join(lines)

    def _extract_price(self, text: str) -> Optional[int]:
        import re
        cleaned = text.replace(",", "")
        matches = re.findall(r'[\u20aa]?\s*(\d[\d]{4,})', cleaned)
        for m in matches:
            try:
                val = int(m)
                if 10_000 < val < 2_000_000:
                    return val
            except ValueError:
                pass
        return None

    def _classify(self, text: str) -> str:
        t = text.lower()
        if "accept" in t or "מסכים" in t or "סגור" in t or "בסדר גמור" in t:
            return "accept"
        if "escalate" in t or "מעדכן" in t or "להודיע" in t:
            return "escalate"
        if "reject" in t or "לא מקבל" in t or "נמוך מדי" in t:
            return "reject"
        return "msg"

    def add_message(self, actor: str, text: str, price: Optional[int] = None, kind: str = "msg") -> dict:
        msg = {
            "id": str(uuid.uuid4())[:8],
            "actor": actor,
            "text": text,
            "price": price,
            "kind": kind,
            "ts": time.time(),
        }
        self.messages.append(msg)
        return msg

    async def _call_gpt(self, system: str, user_msg: str) -> str:
        key = os.getenv("OPENAI_API_KEY", "")
        if not key:
            return "[AI unavailable — no API key]"
        import openai
        client = openai.AsyncOpenAI(api_key=key)
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.82,
                max_tokens=200,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            return f"[שגיאת AI: {e}]"

    async def dealer_reply(self, buyer_message: str) -> dict:
        """Generate dealer agent response to a buyer message. Returns msg dict."""
        summary = self._history_summary()
        reply = await self._call_gpt(
            self.dealer.system_prompt(summary),
            f"הקונה אמר: {buyer_message}\n\nענה בקצרה לפי האישיות שלך.",
        )
        price = self._extract_price(reply)
        kind = self._classify(reply)

        msg = self.add_message(
            actor=f"dealer_{self.dealer.persona_id}",
            text=reply,
            price=price,
            kind=kind,
        )

        if kind == "accept" and price and price >= self.dealer.floor_price:
            self.deal = {"price": price, "car": self.dealer.car, "ts": time.time()}
            self.active = False
            self.dealer.dealer_status = "done"
            self.escalations.append(
                f"\u2705 WhatsApp \u2192 {self.dealer.persona['name']}: "
                f"\u05e2\u05e1\u05e7\u05d4 \u05e0\u05e1\u05d2\u05e8\u05d4 \u05d1-\u20aa{price:,}!"
            )
        elif kind == "escalate":
            self.escalations.append(
                f"\u26a0\ufe0f {self.dealer.persona['name']} \u05de\u05d1\u05e7\u05e9 "
                f"\u05d0\u05d9\u05e9\u05d5\u05e8 \u05d0\u05d3\u05dd: {reply[:80]}"
            )

        return msg

    async def dealer_opener(self) -> dict:
        """First message from dealer when session starts."""
        persona = self.dealer.persona
        c = self.dealer.car
        label = f"{c.get('year','')} {c.get('manufacturer','')} {c.get('model','')}".strip()
        prompt = (
            f"A buyer just walked up to you in the הבסטה bazaar. "
            f"Greet them in your unique style and present your car ({label}, "
            f"\u20aa{self.dealer.asking_price:,}) to open the negotiation. "
            f"Be yourself — short, vivid, in character."
        )
        reply = await self._call_gpt(self.dealer.system_prompt("Session just opened."), prompt)
        price = self._extract_price(reply)
        return self.add_message(
            actor=f"dealer_{self.dealer.persona_id}",
            text=reply,
            price=price or self.dealer.asking_price,
            kind="opener",
        )

    def status(self) -> dict:
        return {
            "session_id": self.session_id,
            "active": self.active,
            "deal": self.deal,
            "msg_count": len(self.messages),
            "escalations": self.escalations,
            "dealer": self.dealer.lobby_card(),
        }


# ── In-memory lobby store ─────────────────────────────────────────────────────

_LOBBY_DEALERS: dict[str, DealerAgent] = {}
_LOBBY_SESSIONS: dict[str, LobbySession] = {}


def get_lobby() -> list[dict]:
    """Return all dealer lobby cards."""
    return [d.lobby_card() for d in _LOBBY_DEALERS.values()]


def seed_lobby(cars: Optional[list[dict]] = None) -> None:
    """Populate the lobby with demo dealer agents (one per persona)."""
    _LOBBY_DEALERS.clear()

    demo_cars = [
        {"manufacturer": "טויוטה", "model": "קורולה", "year": 2019, "km": 82000},
        {"manufacturer": "מאזדה", "model": "3", "year": 2021, "km": 45000},
        {"manufacturer": "קיה", "model": "ספורטאז'", "year": 2020, "km": 67000},
        {"manufacturer": "היונדאי", "model": "i35", "year": 2018, "km": 91000},
        {"manufacturer": "פולקסווגן", "model": "גולף", "year": 2022, "km": 28000},
    ]
    used_cars = cars or demo_cars

    for i, persona in enumerate(DEALER_PERSONAS):
        car = used_cars[i % len(used_cars)]
        asking = 75000 + i * 18000
        floor = int(asking * 0.88)
        agent = DealerAgent(
            persona_id=persona["id"],
            car=car,
            asking_price=asking,
            floor_price=floor,
        )
        _LOBBY_DEALERS[agent.session_id] = agent


def get_dealer(session_id: str) -> Optional[DealerAgent]:
    return _LOBBY_DEALERS.get(session_id)


def create_session(dealer_session_id: str, buyer_name: str = "קונה", buyer_budget: Optional[int] = None) -> Optional[LobbySession]:
    dealer = _LOBBY_DEALERS.get(dealer_session_id)
    if not dealer or dealer.dealer_status != "waiting":
        return None
    dealer.dealer_status = "in_session"
    session = LobbySession(dealer=dealer, buyer_name=buyer_name, buyer_budget=buyer_budget)
    _LOBBY_SESSIONS[session.session_id] = session
    return session


def get_session(session_id: str) -> Optional[LobbySession]:
    return _LOBBY_SESSIONS.get(session_id)


# Seed on import so the lobby is immediately populated
seed_lobby()
