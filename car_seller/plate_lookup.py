"""
Israeli license plate → vehicle details lookup.

Uses the data.gov.il public CKAN API:
  Resource: 053cea08-09bc-40ec-8f7a-156f0677aff3  (private & commercial vehicles)

Actual fields in this resource (confirmed by API introspection):
  mispar_rechev     – license plate number
  tozeret_nm        – manufacturer Hebrew name
  degem_nm          – model code (internal, e.g. "VZJ90L-GJPNKW")
  kinuy_mishari     – commercial name (e.g. "COROLLA 1.6", "PRADO")
  ramat_gimur       – trim level (e.g. "CLASSICOPLUS", "STD")
  shnat_yitzur      – year of manufacture
  tzeva_rechev      – color Hebrew name
  sug_delek_nm      – fuel type Hebrew name
  degem_manoa       – engine MODEL CODE (e.g. "5VZ") — NOT engine cc
  mivchan_acharon_dt– last annual test (טסט) date
  tokef_dt          – license validity (תוקף רישיון) date
  baalut            – ownership TYPE (e.g. "פרטי" = private) — NOT hand number
  misgeret          – VIN / chassis number
  moed_aliya_lakvish– first road registration date
  zmig_kidmi/ahori  – tire spec front/rear
  kvutzat_zihum     – pollution group

NOT available in this resource:
  engine_volume (cc), doors, body type, city, hand number (previous owner count)

Where do Yad2 / other sites get these?
  From the vehicle model catalog resources on data.gov.il (e.g. degem-rechev-wltp
  package) which link via degem_cd / tozeret_cd to specs tables. These require a
  second lookup by model code. For now we parse these from the PDF (רישיון רכב)
  when the user uploads one. Implementing the second API lookup is a TODO.
"""
from __future__ import annotations

from typing import Optional
import httpx

GOV_CKAN = "https://data.gov.il/api/3/action/datastore_search"
VEHICLE_RESOURCE = "053cea08-09bc-40ec-8f7a-156f0677aff3"

_COLOR_MAP = {
    "לבן": "White", "שחור": "Black", "כסף": "Silver", "אפור": "Gray",
    "כחול": "Blue", "אדום": "Red", "ירוק": "Green", "צהוב": "Yellow",
    "כתום": "Orange", "חום": "Brown", "זהב": "Gold", "בורדו": "Burgundy",
    "בז'": "Beige", "סגול": "Purple", "טורקיז": "Turquoise",
}

_FUEL_MAP = {
    "בנזין": "Petrol", "דיזל": "Diesel", "חשמל": "Electric",
    "היברידי": "Hybrid", "גז": "Gas", "פלאג אין": "Plug-in Hybrid",
}

_BODY_MAP = {
    "סדאן": "Sedan", "האצ'בק": "Hatchback", "קרוסאובר": "Crossover",
    "ג'יפ": "SUV", "קומבי": "Station Wagon", "קופה": "Coupe",
    "קבריולה": "Convertible", "ואן": "Van", "מיניוואן": "Minivan",
    "פיקאפ": "Pickup",
}

_MANUF_MAP = {
    "טויוטה": "Toyota", "יונדאי": "Hyundai", "קיה": "Kia",
    "מאזדה": "Mazda", "הונדה": "Honda", "ניסאן": "Nissan",
    "סוזוקי": "Suzuki", "סובארו": "Subaru", "פולקסווגן": "Volkswagen",
    "סקודה": "Skoda", "טסלה": "Tesla", "ב.מ.וו": "BMW",
    "מרצדס": "Mercedes", "אאודי": "Audi", "וולוו": "Volvo",
    "פורד": "Ford", "ג'יפ": "Jeep", "מיצובישי": "Mitsubishi",
    "פיג'ו": "Peugeot", "רנו": "Renault", "סיאט": "Seat",
    "אופל": "Opel", "סיטרואן": "Citroen", "פיאט": "Fiat",
    "שברולט": "Chevrolet", "לקסוס": "Lexus", "פורשה": "Porsche",
    "שיאומי": "Xiaomi", "BYD": "BYD", "ביואיד": "BYD",
    "לנד רובר": "Land Rover", "ג'אגואר": "Jaguar",
    "אלפא רומיאו": "Alfa Romeo", "מיני": "Mini", "סמארט": "Smart",
    "מאזראטי": "Maserati", "בנטלי": "Bentley", "רולס רויס": "Rolls-Royce",
    "פררי": "Ferrari", "למבורגיני": "Lamborghini",
    "לינקולן": "Lincoln", "קאדילאק": "Cadillac", "דודג'": "Dodge",
    "קרייזלר": "Chrysler",
}


def _map(mapping: dict[str, str], value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    for heb, eng in mapping.items():
        if heb in value:
            return eng
    return value


def lookup_plate(plate_number: str) -> Optional[dict]:
    """
    Query data.gov.il for a license plate number.
    Returns a normalized dict or None if not found.
    """
    plate = plate_number.strip().replace("-", "").replace(" ", "")

    params = {
        "resource_id": VEHICLE_RESOURCE,
        "filters": f'{{"mispar_rechev": "{plate}"}}',
        "limit": 5,
    }

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(GOV_CKAN, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise RuntimeError(f"data.gov.il API error: {e}") from e

    if not data.get("success"):
        return None

    records = data.get("result", {}).get("records", [])
    if not records:
        return None

    r = records[0]

    manuf_heb = r.get("tozeret_nm", "") or ""
    manuf_eng = _map(_MANUF_MAP, manuf_heb) or manuf_heb

    model_heb = r.get("degem_nm", "") or ""
    commercial_name = r.get("kinuy_mishari", "") or ""

    color_heb = r.get("tzeva_rechev", "") or ""
    color_eng = _map(_COLOR_MAP, color_heb) or color_heb

    fuel_heb = r.get("sug_delek_nm", "") or ""
    fuel_eng = _map(_FUEL_MAP, fuel_heb) or fuel_heb

    # This resource does not have body type or engine cc directly.
    # degem_manoa is the engine MODEL CODE (e.g. "939A5000"), not cc.
    # sug_guf_nm / mispar_manoa / mispar_dlatot are not in this resource.
    body_heb = ""
    body_eng = None

    year_raw = r.get("shnat_yitzur")
    try:
        year = int(year_raw) if year_raw else None
    except (ValueError, TypeError):
        year = None

    # baalut is ownership type text (e.g. "פרטי" = private), not hand number
    baalut = r.get("baalut", "") or ""
    # hand number not directly available in this resource
    hand = None

    # Extra fields available
    trim = r.get("ramat_gimur", "") or ""          # e.g. "CLASSICOPLUS"
    vin = r.get("misgeret", "") or ""              # VIN/chassis number
    last_test = r.get("mivchan_acharon_dt", "") or ""  # last annual test date
    license_expiry = r.get("tokef_dt", "") or ""   # license validity date
    first_reg = r.get("moed_aliya_lakvish", "") or ""  # first registration
    tire_front = r.get("zmig_kidmi", "") or ""
    tire_rear = r.get("zmig_ahori", "") or ""
    pollution = r.get("kvutzat_zihum")

    return {
        "plate": plate,
        "manufacturer_heb": manuf_heb.strip(),
        "manufacturer_en": manuf_eng.strip(),
        "model_heb": model_heb.strip(),
        "model_en": commercial_name.strip() or model_heb.strip(),
        "commercial_name": commercial_name.strip(),
        "year": year,
        "color_heb": color_heb.strip(),
        "color_en": color_eng.strip() if color_eng else None,
        "fuel_type_heb": fuel_heb.strip(),
        "fuel_type_en": fuel_eng.strip() if fuel_eng else None,
        "engine_volume": None,           # not in this resource
        "body_type_heb": body_heb,
        "body_type_en": body_eng,
        "doors": None,                   # not in this resource
        "hand": hand,
        "ownership_type": baalut.strip(),  # "פרטי" (private) or "מסחרי" etc.
        "drive_type": "",
        "city": "",
        "trim": trim.strip(),
        "vin": vin.strip(),
        "last_test_date": last_test.strip(),
        "license_expiry": license_expiry.strip(),
        "first_registration": first_reg.strip(),
        "tire_front": tire_front.strip(),
        "tire_rear": tire_rear.strip(),
        "pollution_group": pollution,
        "raw": r,
    }
