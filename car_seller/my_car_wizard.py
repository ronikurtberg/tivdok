"""Interactive wizard to collect MyCar details from the user."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt, Confirm

from car_seller.models import MyCar

console = Console()
CARS_FILE = Path("my_cars.json")


def _ask_str(label: str, default: Optional[str] = None, required: bool = True) -> Optional[str]:
    val = Prompt.ask(f"  {label}", default=default or "")
    if not val:
        if required:
            console.print("  [red]This field is required.[/]")
            return _ask_str(label, default, required)
        return None
    return val


def _ask_int(label: str, default: Optional[int] = None, required: bool = True) -> Optional[int]:
    while True:
        raw = Prompt.ask(f"  {label}", default=str(default) if default is not None else "")
        if not raw:
            if required:
                console.print("  [red]This field is required.[/]")
                continue
            return None
        try:
            return int(raw.replace(",", "").replace(".", ""))
        except ValueError:
            console.print("  [red]Please enter a valid integer.[/]")


def collect_car_details() -> MyCar:
    console.print(Panel("[bold green]🚗 Your Car Details Wizard[/]", expand=False))
    console.print("  Fill in the details of the car you want to sell.\n")

    manufacturer = _ask_str("Manufacturer (e.g. Toyota, Hyundai, Kia)")
    model = _ask_str("Model (e.g. Corolla, Tucson)")
    sub_model = _ask_str("Sub-model / Trim (e.g. GLI Premium)", required=False)
    year = _ask_int("Year of production")
    km = _ask_int("Current mileage (km)")
    hand = _ask_int("How many owners (including you)?", default=1)
    color = _ask_str("Color (English)", required=False)
    gear_box = _ask_str("Transmission (Automatic / Manual)", required=False)
    engine_type = _ask_str("Fuel type (Petrol / Diesel / Hybrid / Electric)", required=False)
    engine_volume = _ask_int("Engine volume (cc, e.g. 1600)", required=False)
    horse_power = _ask_int("Horse power", required=False)
    doors = _ask_int("Number of doors", required=False)
    seats = _ask_int("Number of seats", required=False)
    body_type = _ask_str("Body type (Sedan / SUV / Hatchback / Crossover)", required=False)
    city = _ask_str("City where the car is located (English)", required=False)
    test_date = _ask_str("Test (Tesт) expiry date (YYYY-MM, e.g. 2026-08)", required=False)
    asking_price = _ask_int("Your desired asking price (₪ ILS, or press Enter to skip)", required=False)
    description = _ask_str("Notes about the car condition (free text)", required=False)

    car = MyCar(
        manufacturer=manufacturer,
        model=model,
        sub_model=sub_model,
        year=year,
        km=km,
        hand=hand,
        color=color,
        gear_box=gear_box,
        engine_type=engine_type,
        engine_volume=engine_volume,
        horse_power=horse_power,
        doors=doors,
        seats=seats,
        body_type=body_type,
        city=city,
        test_date=test_date,
        asking_price=asking_price,
        description=description,
    )
    return car


def save_car(car: MyCar) -> None:
    cars: list[dict] = []
    if CARS_FILE.exists():
        try:
            cars = json.loads(CARS_FILE.read_text())
        except Exception:
            cars = []
    cars.append(car.model_dump())
    CARS_FILE.write_text(json.dumps(cars, indent=2, ensure_ascii=False))
    console.print(f"  [green]✓ Car saved to {CARS_FILE}[/]")


def load_cars() -> list[MyCar]:
    if not CARS_FILE.exists():
        return []
    try:
        data = json.loads(CARS_FILE.read_text())
        return [MyCar(**d) for d in data]
    except Exception:
        return []


def pick_car(cars: list[MyCar]) -> Optional[MyCar]:
    """Let the user choose from their saved cars."""
    if not cars:
        return None
    console.print("\n[bold]Your saved cars:[/]")
    for i, c in enumerate(cars, 1):
        price_str = f"  Asking: ₪{c.asking_price:,}" if c.asking_price else ""
        console.print(f"  [cyan]{i}.[/] {c.year} {c.manufacturer} {c.model} — {c.km:,} km{price_str}")
    idx = _ask_int(f"Select a car [1-{len(cars)}]")
    if idx is None or idx < 1 or idx > len(cars):
        console.print("[red]Invalid selection.[/]")
        return None
    return cars[idx - 1]
