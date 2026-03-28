"""
Official / catalog price lookup.

Israel's Ministry of Transport publishes a vehicle catalog through data.gov.il.
We query the CKAN API at https://data.gov.il/api/3/action/datastore_search
using the resource ID for the vehicle catalog table.

Resource ID (as of 2025): "053cea08-09bc-40ec-8f7a-156f0677aff3"
Fields we care about: manufacturer, model, year, degem_mankal (catalog price in ILS)
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from rich.console import Console

from car_seller.models import MyCar

console = Console()

GOV_API = "https://data.gov.il/api/3/action/datastore_search"

# The vehicle catalog resource on data.gov.il
VEHICLE_RESOURCE_ID = "053cea08-09bc-40ec-8f7a-156f0677aff3"

# Manufacturer name mapping Hebrew → English common variants
_MANUF_MAP: dict[str, list[str]] = {
    "Toyota": ["טויוטה", "TOYOTA"],
    "Hyundai": ["יונדאי", "HYUNDAI"],
    "Kia": ["קיה", "KIA"],
    "Mazda": ["מאזדה", "MAZDA"],
    "Honda": ["הונדה", "HONDA"],
    "Nissan": ["ניסאן", "NISSAN"],
    "Suzuki": ["סוזוקי", "SUZUKI"],
    "Subaru": ["סובארו", "SUBARU"],
    "Volkswagen": ["פולקסווגן", "VW", "VOLKSWAGEN"],
    "Skoda": ["סקודה", "SKODA"],
    "Tesla": ["טסלה", "TESLA"],
    "BMW": ["ב.מ.וו", "BMW"],
    "Mercedes": ["מרצדס", "MERCEDES"],
    "Audi": ["אאודי", "AUDI"],
    "Volvo": ["וולוו", "VOLVO"],
    "Ford": ["פורד", "FORD"],
    "Jeep": ["ג'יפ", "JEEP"],
    "BYD": ["BYD", "ביואיד"],
    "Mitsubishi": ["מיצובישי", "MITSUBISHI"],
    "Peugeot": ["פיג'ו", "PEUGEOT"],
    "Renault": ["רנו", "RENAULT"],
    "Seat": ["סיאט", "SEAT"],
    "Opel": ["אופל", "OPEL"],
    "Citroen": ["סיטרואן", "CITROEN"],
    "Fiat": ["פיאט", "FIAT"],
    "Chevrolet": ["שברולט", "CHEVROLET"],
    "Lexus": ["לקסוס", "LEXUS"],
    "Porsche": ["פורשה", "PORSCHE"],
}


def _variants(manufacturer: str) -> list[str]:
    """Return all known name variants for a manufacturer."""
    for eng, others in _MANUF_MAP.items():
        if manufacturer.lower() in [eng.lower()] + [o.lower() for o in others]:
            return [eng] + others
    return [manufacturer]


def lookup_official_price(car: MyCar) -> Optional[int]:
    """
    Query data.gov.il vehicle catalog and return the catalog (mankal) price in ILS.
    Returns None if not found or on network error.
    """
    console.print(f"\n[bold cyan]▶ Looking up official catalog price for {car.manufacturer} {car.model} {car.year}…[/]")

    variants = _variants(car.manufacturer)

    for manuf_name in variants:
        params = {
            "resource_id": VEHICLE_RESOURCE_ID,
            "q": f"{manuf_name} {car.model}",
            "limit": 50,
        }
        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(GOV_API, params=params)
                resp.raise_for_status()
                data = resp.json()

            if not data.get("success"):
                continue

            records = data["result"]["records"]
            if not records:
                continue

            # Filter by year
            year_matches = [
                r for r in records
                if str(r.get("shnat_yitzur", "")) == str(car.year)
                   or str(r.get("shnat_yitzur", "")) == str(car.year)
            ]
            candidates = year_matches if year_matches else records

            # Try to find degem_mankal (catalog price)
            for r in candidates:
                price_raw = r.get("degem_mankal") or r.get("mchir_dirugit") or r.get("mchir_catalog")
                if price_raw:
                    try:
                        price = int(float(str(price_raw).replace(",", "")))
                        if price > 0:
                            console.print(f"  [green]✓ Found catalog price: ₪{price:,}[/] (record: {r.get('kinuy_mishari', '')})")
                            return price
                    except (ValueError, TypeError):
                        continue

        except httpx.HTTPError as e:
            console.print(f"  [yellow]Warning: HTTP error querying data.gov.il: {e}[/]")
        except Exception as e:
            console.print(f"  [yellow]Warning: Unexpected error: {e}[/]")

    console.print("  [yellow]Official catalog price not found — will use market data only.[/]")
    return None
