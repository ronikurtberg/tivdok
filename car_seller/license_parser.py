"""
Parse Israeli vehicle license document (רישיון רכב) PDF.

The Ministry of Transport PDF is RTL Hebrew rendered as plain text by pdfplumber.
Lines come out character-reversed (LTR order) so we reverse each token to recover
readable Hebrew, then match known patterns.
"""
from __future__ import annotations

import re
import io
from typing import Optional

try:
    import pdfplumber
    _HAS_PDFPLUMBER = True
except ImportError:
    _HAS_PDFPLUMBER = False


# ── Hebrew → English mappings ──────────────────────────────────────────────────

_FUEL_MAP = {
    "ןיזנב": "Petrol",
    "לזיד": "Diesel",
    "ינשמ": "Hybrid",
    "ילמשח": "Electric",
    "זג": "Gas (LPG)",
}

_GEAR_MAP = {
    # Reversed RTL tokens from pdfplumber
    "יטמוטוא": "Automatic",     # אוטומטי reversed
    "ינדי": "Manual",            # ידני reversed
    "תינרדג": "Manual",          # גרדנית reversed
    "תיטמוטוא": "Automatic",    # אוטומטית reversed
    # Normal Hebrew
    "אוטומטי": "Automatic",
    "ידני": "Manual",
    "גרדנית": "Manual",
    "אוטומטית": "Automatic",
    "CVT": "Automatic",
    "DSG": "Automatic",
    "DCT": "Automatic",
}

_BODY_MAP = {
    "ןאדס": "Sedan",
    "גניטסה": "Hatchback",
    "ןגאוו טסא": "Station Wagon",
    "וו טסא": "Station Wagon",
    "ידיי": "Jeep/SUV",
    "ינאו": "Van",
    "ףיפ": "Pickup",
    "הרבוק": "Coupe",
    "הלביירק": "Convertible",
}

_MAKE_MAP = {
    "הדוקס": "Skoda",
    "הדנוה": "Honda",
    "הדיוט": "Toyota",
    "הדנלוו": "Volkswagen",
    "ןגאוו סקלוו": "Volkswagen",
    "ילאנר": "Renault",
    "הירוט": "Toyota",
    "הימייה": "Hyundai",
    "יאדנויה": "Hyundai",
    "יאק": "Kia",
    "דרופ": "Ford",
    "לאיסקופ": "Opel",
    "ליאפסקוא": "Opel",
    "לאסקופ": "Opel",
    "הארפ": "Opel",
    "ידאמ": "Mazda",
    "הדזמ": "Mazda",
    "יביס": "Subaru",
    "וראבוס": "Subaru",
    "ילגנה": "Honda",
    "ידיא": "Audi",
    "ידואא": "Audi",
    "יב מ ב": "BMW",
    "ידסרמ": "Mercedes",
    "זדסרמ": "Mercedes",
    "ילאוו": "Volvo",
    "ובלוו": "Volvo",
    "טסאינ": "Nissan",
    "ןאסינ": "Nissan",
    "ינפמ": "Mitsubishi",
    "ישיבוסטימ": "Mitsubishi",
    "יפ וקי": "Jeep",
    "פי'ג": "Jeep",
    "הלדנאה": "Honda",
    "תיפ": "Fiat",
    "טייפ": "Fiat",
    "טנרוא": "Citroen",
    "ןואורטיס": "Citroen",
    "וגייפ": "Peugeot",
    "ואגייפ": "Peugeot",
    "אידלא": "Alfa Romeo",
    "ומאור אפלא": "Alfa Romeo",
    "היקסל": "Lexus",
    "סוסקל": "Lexus",
    "טסוגוא": "Audi",
    "ליטוב": "Volkswagen",
    "יגאוו": "Jeep",
    "ירוק": "Kia",
    "טיינסש": "Suzuki",
    "יקוזוס": "Suzuki",
    "לאסקוא": "Opel",
    "ספ'ג": "Jeep",
    "ינ'ג": "Genesis",
    "סיסנ'ג": "Genesis",
}


def _rev(s: str) -> str:
    """Reverse a string (undo RTL character order from pdfplumber)."""
    return s[::-1]


def _find_plate(lines: list[str]) -> Optional[str]:
    """Israeli plates: 7-8 digits."""
    for line in lines:
        for token in line.split():
            if re.fullmatch(r"\d{7,8}", token):
                return token
    return None


def _find_vin(lines: list[str]) -> Optional[str]:
    """VIN: 17 alphanumeric chars."""
    for line in lines:
        m = re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", line)
        if m:
            return m.group()
    return None


def _find_engine_cc(lines: list[str]) -> Optional[int]:
    """Engine cc: 3-4 digit number appearing near fuel type line."""
    for i, line in enumerate(lines):
        for token in line.split():
            if re.fullmatch(r"\d{3,4}", token):
                val = int(token)
                if 500 < val < 9000:
                    return val
    return None


def _find_year(lines: list[str]) -> Optional[int]:
    """Find manufacture year — prefer MM/YYYY patterns, take the earliest year found."""
    years = []
    for line in lines:
        for m in re.finditer(r"\b(\d{1,2})/(20\d{2}|19\d{2})\b", line):
            years.append(int(m.group(2)))
        # also bare year tokens
        for m in re.finditer(r"\b(20\d{2}|19\d{2})\b", line):
            years.append(int(m.group()))
    # Filter to plausible manufacture years (not future license dates)
    plausible = [y for y in years if 1980 <= y <= 2025]
    return min(plausible) if plausible else (min(years) if years else None)


def _find_first_reg(lines: list[str]) -> Optional[str]:
    """Date pattern MM/YYYY — earliest one is first registration."""
    found = []
    for line in lines:
        for m in re.finditer(r"\b(\d{1,2}/(?:20\d{2}|19\d{2}))\b", line):
            found.append(m.group())
    if not found:
        return None
    # Sort by year then month, take earliest
    def _sort_key(d):
        parts = d.split('/')
        return (int(parts[1]), int(parts[0]))
    found.sort(key=_sort_key)
    return found[0]


def _find_mileage(lines: list[str]) -> Optional[int]:
    """Mileage: pattern like מ'ק 87,453 or km followed by digits."""
    all_text = " ".join(lines)
    m = re.search(r"[\u05de\u05f3\u05e7]\s*([0-9]{2,3},[0-9]{3})", all_text)
    if m:
        return int(m.group(1).replace(",", ""))
    m = re.search(r"\b([0-9]{2,3},[0-9]{3})\b", all_text)
    if m:
        val = int(m.group(1).replace(",", ""))
        if 1000 < val < 999000:
            return val
    return None


def _find_tires(lines: list[str]) -> Optional[str]:
    """Tire spec like 205/55R16, 205/55 R16, or reversed RTL: R16 91 V 205/55."""
    for line in lines:
        # Normal order: 205/55R16 or 205/55 R16
        m = re.search(r"(\d{3}/\d{2})\s*R(\d{2})", line)
        if m:
            return f"{m.group(1)}R{m.group(2)}"
        # Reversed RTL order: R16 91 V 205/55
        m = re.search(r"R(\d{2})\s+\d+\s+[A-Z]\s+(\d{3}/\d{2})", line)
        if m:
            return f"{m.group(2)}R{m.group(1)}"
    return None


def _find_license_expiry(lines: list[str]) -> Optional[str]:
    """License valid date DD/MM/YY or DD/MM/YYYY."""
    dates = []
    for line in lines:
        for m in re.finditer(r"\b(\d{1,2}/\d{1,2}/\d{2,4})\b", line):
            dates.append(m.group())
    if dates:
        return dates[0]
    return None


# Known model names (ordered longest-first to prefer specific over generic)
_KNOWN_MODELS = [
    "OCTAVIA", "FABIA", "SUPERB", "SCALA", "KAROQ", "KODIAQ", "KAMIQ",
    "COROLLA", "CAMRY", "YARIS", "RAV4", "HILUX", "PRIUS", "AURIS", "AVENSIS",
    "GOLF", "POLO", "PASSAT", "TIGUAN", "TOUAREG", "ARTEON", "CADDY",
    "CIVIC", "ACCORD", "CRV", "HRV", "JAZZ",
    "CLIO", "MEGANE", "LAGUNA", "KADJAR", "KOLEOS", "CAPTUR", "DUSTER",
    "TUCSON", "ELANTRA", "SONATA", "IONIQ", "KONA", "SANTA",
    "SPORTAGE", "SORENTO", "CERATO", "STONIC", "CEED",
    "FOCUS", "FIESTA", "MONDEO", "KUGA", "PUMA", "RANGER",
    "ASTRA", "INSIGNIA", "ZAFIRA", "MOKKA", "CROSSLAND",
    "C3", "C4", "C5", "BERLINGO",
    "208", "308", "508", "3008", "5008",
    "A3", "A4", "A5", "A6", "A7", "Q3", "Q5", "Q7",
    "C180", "C200", "C300", "E200", "E300", "GLA", "GLC", "GLE",
    "316", "318", "320", "328", "330", "520", "530",
    "3", "6", "CX3", "CX5", "CX30",
    "JUKE", "QASHQAI", "X-TRAIL", "MICRA", "LEAF",
    "OUTLANDER", "ECLIPSE", "ASX", "LANCER",
    "IMPREZA", "FORESTER", "OUTBACK", "XV",
    "SWIFT", "VITARA", "JIMNY", "BALENO",
    "159", "GIULIA", "STELVIO",
    "YETI", "RAPID",
    "PUNTO", "500", "BRAVO", "TIPO",
    "SENTRA", "TIIDA",
    "LANCER", "GALANT",
    "RX", "NX", "UX", "IS", "ES", "LS",
    "CHEROKEE", "COMPASS", "RENEGADE", "WRANGLER",
    "GENESIS", "G70", "G80",
]

_KNOWN_TRIMS = [
    "AMBITION", "ELEGANCE", "STYLE", "ACTIVE", "COMFORT", "LUXURY",
    "SPORTLINE", "PREMIUM", "EXECUTIVE", "EDITION", "ADVANCE", "EXCLUSIVE",
    "CREATIVE", "ALLURE", "INTENSITY", "ICONIC", "DYNAMIC", "PRESTIGE",
    "SPORT", "SE", "RS", "GTI", "TDI", "TSI", "HYBRID", "PLUS",
    "ELITE", "ULTIMATE", "LIMITED", "TITANIUM", "SIGNATURE", "BUSINESS",
]


def _find_make_model(lines: list[str]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Returns (make_heb, make_en, model_en).
    Prioritise known model list over generic all-caps words.
    """
    all_text = " ".join(lines)

    # Look for known Hebrew make
    make_heb = None
    make_en = None
    for heb, eng in _MAKE_MAP.items():
        if heb in all_text:
            make_heb = heb
            make_en = eng
            break

    # Model: prefer known models list (longer names first)
    model_en = None
    models_sorted = sorted(_KNOWN_MODELS, key=len, reverse=True)
    for line in lines:
        for model in models_sorted:
            if re.search(r"\b" + model + r"\b", line):
                model_en = model
                break
        if model_en:
            break

    # Fallback: any all-caps Latin word that isn't a trim word
    if not model_en:
        for line in lines:
            for token in line.split():
                if (re.fullmatch(r"[A-Z]{4,}", token)
                        and token not in _KNOWN_TRIMS
                        and token not in ("DAD", "VIN", "PDF", "TMBAR")):
                    model_en = token
                    break
            if model_en:
                break

    return make_heb, make_en, model_en


def _find_trim(lines: list[str]) -> Optional[str]:
    """Trim: match known trim list."""
    all_text = " ".join(lines)
    for trim in _KNOWN_TRIMS:
        if re.search(r"\b" + trim + r"\b", all_text):
            return trim
    return None


def _find_gear_box(lines: list[str]) -> Optional[str]:
    """Detect transmission type: Automatic or Manual."""
    all_text = " ".join(lines)
    for token, eng in _GEAR_MAP.items():
        if token in all_text:
            return eng
    return None


def _find_body_type(lines: list[str]) -> tuple[Optional[str], Optional[str]]:
    all_text = " ".join(lines)
    for heb, eng in _BODY_MAP.items():
        if heb in all_text:
            return heb, eng
    return None, None


def _find_fuel(lines: list[str]) -> tuple[Optional[str], Optional[str]]:
    all_text = " ".join(lines)
    for heb, eng in _FUEL_MAP.items():
        if heb in all_text:
            return heb, eng
    return None, None


def _find_city(lines: list[str]) -> Optional[str]:
    """City usually follows a 5-digit zip code."""
    for line in lines:
        m = re.search(r"\d{5}\s+([\u05d0-\u05ea\s]+)", line)
        if m:
            city_heb = m.group(1).strip()
            return _rev(city_heb) if city_heb else None
    return None


def _find_horse_power(lines: list[str]) -> Optional[int]:
    """
    Horse power from lines like: '00676-0844 18-0301 כנ כנ 7 14 כנ 150.00'
    or reversed RTL: '150.00 \u05e9\u05db\"\u05e0' (כנ"ש = horse power).
    Also matches plain pattern near כ"ס or כ"נ or כנ.
    """
    all_text = " ".join(lines)
    # Look for a decimal/integer near the Hebrew abbreviation for HP
    m = re.search(r"(\d{2,4})(?:\.\d+)?\s*(?:\u05db\u05e0|\u05db\"\u05e0|\u05db\"\u05e1|\u05e9\u05db\"\u05e0|\u05e9\u05db\"\u05e1)", all_text)
    if m:
        return int(m.group(1))
    # Reversed order: כנ"ש 150.00 or כנ 150
    m = re.search(r"(?:\u05db\u05e0|\u05db\"\u05e0|\u05db\"\u05e1|\u05e9\u05db\"\u05e0|\u05e9\u05db\"\u05e1)\s+(\d{2,4})(?:\.\d+)?", all_text)
    if m:
        return int(m.group(1))
    # Look for pattern: 'כנ 150.00' anywhere in text (reversed tokens like 'כנ')
    m = re.search(r"\b(\d{2,4})\.00\b", all_text)
    if m:
        val = int(m.group(1))
        if 50 < val < 700:  # plausible HP range
            return val
    return None


def _find_doors(lines: list[str]) -> Optional[int]:
    """
    Doors count from line like: '3 AMBITION OCTAVIA' — a single digit 2-7
    appearing on same line as model or trim name.
    """
    for line in lines:
        # Line must contain a known model or trim
        if not re.search(r"[A-Z]{3,}", line):
            continue
        for token in line.split():
            if re.fullmatch(r"[2-7]", token):
                return int(token)
    return None


def _find_hand(lines: list[str]) -> Optional[int]:
    """
    Owner/hand number. RTL-reversed PDF has lines like '01 רכחה/הרכשה'
    where רכחה = הכרב reversed, הרכשה = הרכישה reversed.
    Also handles normal order: 'הרכישה/הכרב 01' or 'בעלות 1'.
    """
    # All keyword variants (both reversed and normal Hebrew)
    OWNERSHIP_KEYWORDS = [
        "\u05e8\u05db\u05d7\u05d4",   # רכחה  (הכרב reversed)
        "\u05d4\u05e8\u05db\u05e9\u05d4",   # הרכשה  (הרכישה reversed)
        "\u05d4\u05db\u05e8\u05d1",   # הכרב  (normal)
        "\u05d4\u05e8\u05db\u05d9\u05e9\u05d4",  # הרכישה (normal)
        "\u05d1\u05e2\u05dc\u05d5\u05ea",   # בעלות
    ]
    for line in lines:
        if not any(kw in line for kw in OWNERSHIP_KEYWORDS):
            continue
        # digit before keyword: '01 רכחה' or '01 הרכשה'
        m = re.search(r"(\d{1,2})\s+(?:" + "|".join(OWNERSHIP_KEYWORDS) + ")", line)
        if m:
            val = int(m.group(1))
            if 1 <= val <= 20:
                return val
        # digit after keyword: 'הרכישה 01'
        m = re.search(r"(?:" + "|".join(OWNERSHIP_KEYWORDS) + r")[/\s]+(\d{1,2})", line)
        if m:
            val = int(m.group(1))
            if 1 <= val <= 20:
                return val
    return None


def parse_license_pdf(file_bytes: bytes) -> dict:
    """
    Parse an Israeli vehicle license PDF and return structured vehicle data.
    Returns a dict with all discoverable fields.
    """
    if not _HAS_PDFPLUMBER:
        raise RuntimeError("pdfplumber is not installed. Run: uv pip install pdfplumber")

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        raw_lines: list[str] = []
        for page in pdf.pages:
            text = page.extract_text() or ""
            raw_lines.extend(text.splitlines())

    plate = _find_plate(raw_lines)
    vin = _find_vin(raw_lines)
    year = _find_year(raw_lines)
    first_reg = _find_first_reg(raw_lines)
    engine_cc = _find_engine_cc(raw_lines)
    mileage = _find_mileage(raw_lines)
    tires = _find_tires(raw_lines)
    license_expiry = _find_license_expiry(raw_lines)
    make_heb, make_en, model_en = _find_make_model(raw_lines)
    trim = _find_trim(raw_lines)
    body_heb, body_en = _find_body_type(raw_lines)
    fuel_heb, fuel_en = _find_fuel(raw_lines)
    city = _find_city(raw_lines)
    horse_power = _find_horse_power(raw_lines)
    doors = _find_doors(raw_lines)
    hand = _find_hand(raw_lines)
    gear_box = _find_gear_box(raw_lines)

    return {
        "plate": plate,
        "manufacturer_heb": make_heb or "",
        "manufacturer_en": make_en or "",
        "model_en": model_en or "",
        "commercial_name": f"{make_en or ''} {model_en or ''}".strip(),
        "trim": trim,
        "year": year,
        "first_registration": first_reg,
        "engine_volume": engine_cc,
        "fuel_type_heb": fuel_heb or "",
        "fuel_type_en": fuel_en or "",
        "body_type_heb": body_heb or "",
        "body_type_en": body_en or "",
        "vin": vin,
        "tire_front": tires,
        "tire_rear": tires,
        "license_expiry": license_expiry,
        "mileage_at_last_test": mileage,
        "city": city or "",
        "horse_power": horse_power,
        "doors": doors,
        "hand": hand,
        "gear_box": gear_box,
        "source": "license_pdf",
        "raw_lines": raw_lines,
    }
