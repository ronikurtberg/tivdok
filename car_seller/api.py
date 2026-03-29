"""FastAPI backend for Car Seller Assistant."""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

load_dotenv()

from car_seller.models import MyCar, MarketAnalysis
from car_seller.plate_lookup import lookup_plate
from car_seller.scraper import scrape_market
from car_seller.official_price import lookup_official_price
from car_seller.selling_plan import generate_selling_plan
from car_seller.vehicle_history import get_vehicle_history
from car_seller.license_parser import parse_license_pdf
from car_seller.habasta import create_arena, get_arena

app = FastAPI(
    title="Car Seller Assistant API",
    description="Israeli car selling helper — plate lookup, Yad2 market analysis, selling plans",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CARS_FILE = Path("my_cars.json")

# ── helpers ──────────────────────────────────────────────────────────────────

def _load_cars() -> list[dict]:
    if not CARS_FILE.exists():
        return []
    try:
        return json.loads(CARS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_cars(cars: list[dict]) -> None:
    CARS_FILE.write_text(json.dumps(cars, indent=2, ensure_ascii=False), encoding="utf-8")


# ── schemas ───────────────────────────────────────────────────────────────────

class PlateResponse(BaseModel):
    plate: str
    manufacturer_heb: str
    manufacturer_en: str
    model_heb: str
    model_en: str
    commercial_name: str
    year: Optional[int]
    color_heb: str
    color_en: Optional[str]
    fuel_type_heb: str
    fuel_type_en: Optional[str]
    engine_volume: Optional[int]
    body_type_heb: str
    body_type_en: Optional[str]
    doors: Optional[int]
    hand: Optional[int]
    ownership_type: Optional[str] = None
    drive_type: str
    city: str
    trim: Optional[str] = None
    vin: Optional[str] = None
    last_test_date: Optional[str] = None
    license_expiry: Optional[str] = None
    first_registration: Optional[str] = None
    tire_front: Optional[str] = None
    tire_rear: Optional[str] = None
    pollution_group: Optional[int] = None


class AnalyzeRequest(BaseModel):
    manufacturer: str
    model: str
    year: int
    km: int
    hand: int = 1
    color: Optional[str] = None
    gear_box: Optional[str] = None
    engine_type: Optional[str] = None
    engine_volume: Optional[int] = None
    horse_power: Optional[int] = None
    doors: Optional[int] = None
    seats: Optional[int] = None
    body_type: Optional[str] = None
    city: Optional[str] = None
    test_date: Optional[str] = None
    asking_price: Optional[int] = None
    description: Optional[str] = None
    max_items: int = 100
    exclude_agents: bool = False


class AnalyzeResponse(BaseModel):
    car: dict
    market: dict
    official_price: Optional[int]
    selling_plan: str


class SaveCarRequest(BaseModel):
    car: dict


class ChatRequest(BaseModel):
    message: str
    car: Optional[dict] = None
    market: Optional[dict] = None
    official_price: Optional[int] = None
    history: Optional[list] = None


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/plate/{plate_number}", response_model=PlateResponse)
def get_plate(plate_number: str):
    """Look up an Israeli license plate number and return vehicle details."""
    try:
        result = lookup_plate(plate_number)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No vehicle found for plate '{plate_number}'. Check the number and try again.",
        )

    return PlateResponse(**{k: v for k, v in result.items() if k != "raw"})


@app.post("/api/parse-license")
async def parse_license(file: UploadFile = File(...)):
    """Parse an Israeli vehicle license PDF (רישיון רכב) and return all extracted fields."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    content = await file.read()
    try:
        result = parse_license_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")
    return result


@app.get("/api/history/{plate_number}")
def get_history(plate_number: str):
    """Get vehicle history from Israeli open government datasets."""
    try:
        result = get_vehicle_history(plate_number)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return result


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_car(req: AnalyzeRequest):
    """Run full market analysis: Yad2 scrape + official price + selling plan."""
    car = MyCar(**req.model_dump(exclude={"max_items", "exclude_agents"}))

    try:
        analysis: MarketAnalysis = scrape_market(
            car,
            max_items=req.max_items,
            exclude_agents=req.exclude_agents,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Yad2 scrape error: {e}")

    try:
        official_price = lookup_official_price(car)
    except Exception:
        official_price = None

    plan = generate_selling_plan(car, analysis, official_price)

    return AnalyzeResponse(
        car=car.model_dump(),
        market=analysis.model_dump(),
        official_price=official_price,
        selling_plan=plan,
    )


@app.post("/api/chat")
def chat_with_advisor(req: ChatRequest):
    """AI advisor chat — answers questions using full car context."""
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key or openai_key == "your_openai_api_key_here":
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    import openai
    client = openai.OpenAI(api_key=openai_key)

    car = req.car or {}
    market = req.market or {}

    # Build rich context sections
    car_lines = []
    if car.get("year"):         car_lines.append(f"Year: {car['year']}")
    if car.get("manufacturer"): car_lines.append(f"Make: {car['manufacturer']}")
    if car.get("model"):        car_lines.append(f"Model: {car['model']}")
    if car.get("sub_model"):    car_lines.append(f"Trim: {car['sub_model']}")
    if car.get("km"):           car_lines.append(f"Mileage: {car['km']:,} km")
    if car.get("hand"):         car_lines.append(f"Owner number: {car['hand']} (1 = bought new)")
    if car.get("color"):        car_lines.append(f"Color: {car['color']}")
    if car.get("gear_box"):     car_lines.append(f"Transmission: {car['gear_box']}")
    if car.get("engine_type"):  car_lines.append(f"Fuel: {car['engine_type']}")
    if car.get("engine_volume"): car_lines.append(f"Engine cc: {car['engine_volume']}")
    if car.get("horse_power"): car_lines.append(f"Horsepower: {car['horse_power']} HP")
    if car.get("doors"):        car_lines.append(f"Doors: {car['doors']}")
    if car.get("body_type"):    car_lines.append(f"Body type: {car['body_type']}")
    if car.get("city"):         car_lines.append(f"City: {car['city']}")
    if car.get("test_date"):    car_lines.append(f"Test (תקף) valid until: {car['test_date']}")
    if car.get("asking_price"): car_lines.append(f"Seller's asking price: ₪{car['asking_price']:,}")
    if car.get("description"):  car_lines.append(f"Seller notes: {car['description']}")

    market_lines = []
    if market.get("count"):
        market_lines.append(f"Similar listings on Yad2: {market['count']}")
    if market.get("min_price") and market.get("max_price"):
        market_lines.append(f"Price range: ₪{market['min_price']:,} – ₪{market['max_price']:,}")
    if market.get("avg_price"):
        market_lines.append(f"Average price: ₪{int(market['avg_price']):,}")
    if market.get("median_price"):
        market_lines.append(f"Median price: ₪{int(market['median_price']):,}")
    if market.get("avg_km"):
        market_lines.append(f"Average mileage in market: {int(market['avg_km']):,} km")
        if car.get("km") and market.get("avg_km"):
            delta = car["km"] - market["avg_km"]
            label = "above" if delta > 0 else "below"
            market_lines.append(f"This car's mileage is {abs(int(delta)):,} km {label} market average")
    if market.get("private_count") is not None and market.get("agent_count") is not None:
        market_lines.append(f"Private sellers: {market['private_count']}, Dealers: {market['agent_count']}")
    if req.official_price:
        market_lines.append(f"Official catalog (mankal) price: ₪{req.official_price:,}")
        if market.get("avg_price"):
            dep = round((1 - market["avg_price"] / req.official_price) * 100, 1)
            market_lines.append(f"Market depreciation vs catalog: {dep}%")

    history_lines = []
    if req.history:
        history_lines.append(f"Test history records: {len(req.history)} entries")
        if req.history:
            last = req.history[-1]
            if last.get("test_date"): history_lines.append(f"Last test date: {last['test_date']}")
            if last.get("km"): history_lines.append(f"Mileage at last test: {last['km']:,} km")

    system_prompt = """You are a personal car-selling advisor for an Israeli seller. \
You have full access to this seller's car data, live Yad2 market data, and vehicle history. \
Answer questions ONLY based on this data — give concrete, specific advice the seller cannot get from a generic AI. \
Be direct, practical, and concise. Use ₪ for prices. Reply in the same language the user writes in (Hebrew or English).

SELLER'S CAR:\n""" + "\n".join(car_lines or ["No car data available"]) + """

LIVE MARKET DATA (scraped from Yad2 right now):\n""" + "\n".join(market_lines or ["No market data available"]) + """

VEHICLE TEST HISTORY:\n""" + "\n".join(history_lines or ["No history data available"]) + """

Key rules:
- Always reference the seller's actual numbers when relevant (their price, their km, their hand)
- When comparing to market, use the actual delta values you have
- If asked to write an ad or title, use the real make/model/year/trim/km from above
- If you don't have data for something, say so clearly"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message},
            ],
            temperature=0.6,
            max_tokens=800,
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e}")


@app.get("/api/cars")
def list_cars():
    """List all saved cars."""
    return {"cars": _load_cars()}


@app.post("/api/cars", status_code=201)
def save_car(req: SaveCarRequest):
    """Save a car to local storage."""
    cars = _load_cars()
    cars.append(req.car)
    _save_cars(cars)
    return {"saved": True, "total": len(cars)}


@app.delete("/api/cars/{index}")
def delete_car(index: int):
    """Delete a saved car by index (0-based)."""
    cars = _load_cars()
    if index < 0 or index >= len(cars):
        raise HTTPException(status_code=404, detail="Car not found")
    removed = cars.pop(index)
    _save_cars(cars)
    return {"removed": removed}


# ── הבסטה — AI Agent Bazaar ───────────────────────────────────────────────────

class HabastaCreateRequest(BaseModel):
    seller: dict                 # {car, asking_price, floor_price?, personality?}
    buyers: list                 # [{budget, preferences?, strategy?, name?}]
    max_rounds: int = 12


@app.post("/api/habasta/create")
def habasta_create(req: HabastaCreateRequest):
    """Create a new הבסטה arena session. Returns arena_id."""
    try:
        arena = create_arena(req.seller, req.buyers, req.max_rounds)
        return {"arena_id": arena.id, "status": arena.status()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/habasta/{arena_id}/status")
def habasta_status(arena_id: str):
    """Get current arena status, all events, escalations."""
    arena = get_arena(arena_id)
    if not arena:
        raise HTTPException(status_code=404, detail="Arena not found")
    return {
        "status": arena.status(),
        "events": [e.to_dict() for e in arena.events],
    }


@app.post("/api/habasta/{arena_id}/human-message")
def habasta_human_message(arena_id: str, body: dict):
    """Inject a real human message into the arena (manual walk-in)."""
    arena = get_arena(arena_id)
    if not arena:
        raise HTTPException(status_code=404, detail="Arena not found")
    actor = body.get("actor", "human_seller")
    text = body.get("text", "")
    ev = arena.inject_human_message(actor, text)
    return {"event": ev.to_dict()}


@app.websocket("/ws/habasta/{arena_id}")
async def habasta_ws(websocket: WebSocket, arena_id: str):
    """
    WebSocket stream for הבסטה live negotiation.
    - On connect: starts running rounds and streams each ArenaEvent as JSON
    - Client can send: {"type": "human_msg", "actor": "human_seller", "text": "..."}
      to inject a real human into the arena mid-negotiation
    - Rounds continue until deal, max_rounds, or client disconnects
    """
    arena = get_arena(arena_id)
    if not arena:
        await websocket.close(code=4004)
        return

    await websocket.accept()

    async def send_event(ev):
        await websocket.send_text(json.dumps(ev.to_dict(), ensure_ascii=False))

    # Announce opening
    from car_seller.habasta import ArenaEvent, EventKind
    import time, uuid
    opening = ArenaEvent(
        id=str(uuid.uuid4())[:8],
        kind=EventKind.SYSTEM,
        actor="system",
        content=f"🏪 הבסטה פתוחה! {len(arena.buyers)} קונה/ים נכנסו לזירה. המוכר מוכן. תתחיל ההתמקחות!",
        timestamp=time.time(),
    )
    arena.events.append(opening)
    await send_event(opening)

    try:
        while arena.active:
            # Run one round, streaming each event as it's generated
            round_task = arena.run_round()
            human_injected = False

            async for ev in round_task:
                await send_event(ev)

                # Check for incoming human messages between agent turns
                try:
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.05)
                    data = json.loads(raw)
                    if data.get("type") == "human_msg":
                        hev = arena.inject_human_message(
                            data.get("actor", "human_seller"),
                            data.get("text", ""),
                        )
                        await send_event(hev)
                        human_injected = True
                except (asyncio.TimeoutError, Exception):
                    pass

            if not arena.active:
                break

            # Small pause between rounds
            await asyncio.sleep(1.0)

        # Send final status
        final = {
            "type": "arena_closed",
            "status": arena.status(),
            "escalations": arena.escalations,
        }
        await websocket.send_text(json.dumps(final, ensure_ascii=False))

    except WebSocketDisconnect:
        pass


# ── static files (React build) ────────────────────────────────────────────────

_FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        index = _FRONTEND_DIST / "index.html"
        return FileResponse(str(index))
