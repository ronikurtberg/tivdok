"""Yad2 scraper — parses __NEXT_DATA__ from Yad2's Next.js SSR pages."""
from __future__ import annotations

import json
import re
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Optional

import requests
from rich.console import Console

from car_seller.models import MyCar, MarketAnalysis, Yad2Listing

console = Console()

YAD2_BASE = "https://www.yad2.co.il/vehicles/cars"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8",
    "Referer": "https://www.yad2.co.il/",
}

# ── Static manufacturer name → Yad2 numeric ID ──────────────────────────────
# Collected from live Yad2 __NEXT_DATA__ responses (March 2026).
# Keys are lower-case English names as they come from the gov API.
_MFR_NAME_TO_ID: dict[str, int] = {
    "audi": 1,
    "alfa romeo": 5,
    "bmw": 7,
    "jeep": 10,
    "dacia": 12,
    "honda": 17,
    "volvo": 18,
    "toyota": 19,
    "hyundai": 21,
    "land rover": 24,
    "lexus": 26,
    "mazda": 27,
    "mitsubishi": 30,
    "mercedes": 31,
    "mercedes-benz": 31,
    "nissan": 32,
    "subaru": 35,
    "suzuki": 36,
    "seat": 37,
    "citroen": 38,
    "skoda": 40,
    "volkswagen": 41,
    "ford": 43,
    "porsche": 44,
    "peugeot": 46,
    "cadillac": 47,
    "kia": 48,
    "renault": 51,
    "chevrolet": 52,
    "tesla": 62,
    "genesis": 93,
    "byd": 141,
    "chery": 147,
    "geely": 177,
    "fiat": 4,
    "mini": 29,
    "opel": 33,
    "infiniti": 20,
    "dodge": 13,
    "chrysler": 9,
    "lincoln": 25,
    "ssangyong": 39,
}

# ── Dynamic ID resolution via Yad2's own redirect endpoint ──────────────────

_RESOLVE_URL = "https://gw.yad2.co.il/feed-search-legacy/vehicles/private-cars"
_RESOLVE_HEADERS = {
    "User-Agent": HEADERS["User-Agent"],
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.yad2.co.il/",
}


def _resolve_ids(manufacturer: str, model: str, year_range: str) -> tuple[str, str]:
    """
    Resolve manufacturer/model English names → Yad2 numeric IDs.

    Strategy:
    1. Try the old redirect endpoint (sometimes returns numeric IDs).
    2. Fall back to static manufacturer map, then fetch a manufacturer-only
       page and search similar-links for the model ID.
    """
    # Strip manufacturer prefix if accidentally included in model (e.g. "Skoda OCTAVIA" → "OCTAVIA")
    mfr_stripped = manufacturer.strip().lower()
    if model.strip().lower().startswith(mfr_stripped):
        model = model.strip()[len(mfr_stripped):].strip()

    # ── Step 1: try redirect endpoint ──────────────────────────────────────
    try:
        resp = requests.get(
            _RESOLVE_URL,
            headers=_RESOLVE_HEADERS,
            params={"manufacturer": manufacturer, "model": model, "year": year_range},
            timeout=8,
        )
        resp.raise_for_status()
        redirect = resp.json().get("data", {}).get("redirect", "")
        params = dict(p.split("=", 1) for p in redirect.split("?", 1)[-1].split("&") if "=" in p)
        mfr_id = params.get("manufacturer", "")
        mdl_id = params.get("model", "")
        if mfr_id.isdigit() and mdl_id.isdigit():
            console.print(f"  ✓ Resolved IDs via redirect: mfr={mfr_id} model={mdl_id}")
            return mfr_id, mdl_id
    except Exception as e:
        console.print(f"  [yellow]Redirect resolve failed: {e}[/]")

    # ── Step 2: static manufacturer map ────────────────────────────────────
    mfr_lower = manufacturer.lower().strip()
    static_mfr_id = _MFR_NAME_TO_ID.get(mfr_lower)
    if not static_mfr_id:
        console.print(f"  [yellow]Unknown manufacturer '{manufacturer}' — searching by year only[/]")
        return "", ""

    mfr_id_str = str(static_mfr_id)

    # ── Step 3: fetch manufacturer page, scan similar-links for model ID ───
    model_lower = model.lower().strip()
    try:
        resp2 = requests.get(
            YAD2_BASE,
            headers=HEADERS,
            params={"manufacturer": mfr_id_str},
            timeout=15,
        )
        resp2.raise_for_status()
        m = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
            resp2.text,
            re.DOTALL,
        )
        if m:
            nd = json.loads(m.group(1))
            queries = nd["props"]["pageProps"]["dehydratedState"]["queries"]
            # similar-links query (index 1) contains {query: "manufacturer=40&model=10547", text: "סקודה אוקטביה"}
            links = queries[1]["state"]["data"] if len(queries) > 1 else []
            # Build model id → clean Hebrew name map from similar-links
            link_map: list[tuple[str, str, str]] = []  # (model_id, clean_heb_text, query)
            for link in links:
                raw_text = link.get("text") or ""
                clean_text = re.sub(r"[\u200f\u200e\u202a-\u202e]", "", raw_text).strip().lower()
                link_query = link.get("query") or ""
                mdl_match = re.search(r"model=(\d+)", link_query)
                if mdl_match:
                    link_map.append((mdl_match.group(1), clean_text, link_query))

            _HEB_TRANSLITERATIONS: dict[str, str] = {
                # Skoda
                "octavia": "אוקטביה",
                "fabia": "פאביה",
                "superb": "סופרב",
                "kodiaq": "קודיאק",
                "karoq": "קארוק",
                "rapid": "ראפיד",
                "kamiq": "קאמיק",
                "scala": "סקאלה",
                "enyaq": "אניאק",
                # Volkswagen
                "golf": "גולף",
                "polo": "פולו",
                "passat": "פאסאט",
                "tiguan": "טיגואן",
                "touareg": "טוארג",
                "caddy": "קאדי",
                "t-roc": "t-roc",
                "id.4": "id.4",
                "id.3": "id.3",
                # Kia
                "picanto": "פיקנטו",
                "sportage": "ספורטז'",
                "niro": "נירו",
                "stonic": "סטוניק",
                "sorento": "סורנטו",
                "ceed": "סיד",
                "proceed": "פרוסיד",
                "cerato": "סראטו",
                "seltos": "סלטוס",
                "ev6": "ev6",
                "k5": "k5",
                # Hyundai
                "i10": "i10",
                "i20": "i20",
                "i30": "i30",
                "i35": "i35",
                "tucson": "טוסון",
                "elantra": "אלנטרה",
                "sonata": "סונטה",
                "santa fe": "סנטה פה",
                "kona": "קונה",
                "ioniq": "איוניק",
                "ioniq 5": "איוניק 5",
                "ioniq 6": "איוניק 6",
                "bayon": "ביון",
                # Toyota
                "corolla": "קורולה",
                "camry": "קאמרי",
                "rav4": "rav4",
                "yaris": "יאריס",
                "chr": "c-hr",
                "c-hr": "c-hr",
                "prius": "פריוס",
                "hilux": "הילוקס",
                "land cruiser": "לנד קרוזר",
                "auris": "אוריס",
                # Mazda
                "cx-5": "cx-5",
                "cx5": "cx-5",
                "cx-3": "cx-3",
                "cx-30": "cx-30",
                "mazda3": "מאזדה 3",
                "mazda 3": "מאזדה 3",
                "mazda6": "מאזדה 6",
                "mazda 6": "מאזדה 6",
                # Honda
                "civic": "סיוויק",
                "jazz": "ג'אז",
                "cr-v": "cr-v",
                "crv": "cr-v",
                "hr-v": "hr-v",
                "accord": "אקורד",
                # Nissan
                "qashqai": "קשקאי",
                "juke": "ג'וק",
                "micra": "מיקרה",
                "x-trail": "x-trail",
                "leaf": "ליף",
                # Renault
                "clio": "קליאו",
                "megane": "מגאן",
                "kadjar": "קאדג'ר",
                "captur": "קאפצ'ר",
                "zoe": "זואי",
                "duster": "דאסטר",
                # Peugeot
                "208": "208",
                "308": "308",
                "3008": "3008",
                "508": "508",
                "2008": "2008",
                # Ford
                "focus": "פוקוס",
                "fiesta": "פיאסטה",
                "kuga": "קוגה",
                "mustang": "מוסטנג",
                "puma": "פומה",
                # BMW
                "3 series": "סדרה 3",
                "5 series": "סדרה 5",
                "1 series": "סדרה 1",
                "x1": "x1",
                "x3": "x3",
                "x5": "x5",
                # Mercedes
                "c-class": "מחלקה c",
                "e-class": "מחלקה e",
                "a-class": "מחלקה a",
                "glc": "glc",
                "gla": "gla",
                "gle": "gle",
                # Audi
                "a3": "a3",
                "a4": "a4",
                "a6": "a6",
                "q3": "q3",
                "q5": "q5",
                "q7": "q7",
                # Tesla
                "model 3": "model 3",
                "model y": "model y",
                "model s": "model s",
                "model x": "model x",
                # Suzuki
                "swift": "סוויפט",
                "vitara": "ויטרה",
                "jimny": "ג'ימני",
                "sx4": "sx4",
                # Mitsubishi
                "outlander": "אאוטלנדר",
                "eclipse cross": "אקליפס קרוס",
                "asx": "asx",
                "colt": "קולט",
                # Seat / Cupra
                "ibiza": "איביזה",
                "leon": "ליאון",
                "ateca": "אטקה",
                "arona": "ארונה",
                # Citroen
                "c3": "c3",
                "c4": "c4",
                "c5 aircross": "c5 אייר קרוס",
                # Opel
                "astra": "אסטרה",
                "corsa": "קורסה",
                "mokka": "מוקה",
                # Subaru
                "forester": "פורסטר",
                "outback": "אאוטבק",
                "xv": "xv",
                "impreza": "אימפרזה",
                # Fiat
                "500": "500",
                "tipo": "טיפו",
                "panda": "פנדה",
                # Volvo
                "xc40": "xc40",
                "xc60": "xc60",
                "xc90": "xc90",
                "s60": "s60",
                "s90": "s90",
                # Jeep
                "wrangler": "רנגלר",
                "compass": "קומפס",
                "renegade": "רנגייד",
                "cherokee": "צ'ירוקי",
            }

            heb_target = _HEB_TRANSLITERATIONS.get(model_lower, "")

            for model_id, clean_text, link_query in link_map:
                # Check both the transliteration lookup and substring match
                matched = False
                if heb_target and heb_target in clean_text:
                    matched = True
                elif model_lower in clean_text:
                    matched = True
                if matched:
                    console.print(
                        f"  ✓ Resolved IDs via similar-links: "
                        f"mfr={mfr_id_str} model={model_id} ({clean_text})"
                    )
                    return mfr_id_str, model_id
    except Exception as e:
        console.print(f"  [yellow]Model ID lookup failed: {e}[/]")

    console.print(f"  ✓ Manufacturer resolved: {manufacturer} → {mfr_id_str} (no model filter)")
    return mfr_id_str, ""


# ── HTML page fetching + __NEXT_DATA__ extraction ───────────────────────────

def _fetch_page_html(mfr_id: str, model_id: str, year_range: str, page: int) -> dict:
    """Fetch one Yad2 search results page and extract the __NEXT_DATA__ feed."""
    params: dict[str, str] = {"page": str(page)}
    if mfr_id:
        params["manufacturer"] = mfr_id
    if model_id:
        params["model"] = model_id
    if year_range:
        params["year"] = year_range

    resp = requests.get(YAD2_BASE, headers=HEADERS, params=params, timeout=20)
    resp.raise_for_status()
    html = resp.text

    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not m:
        raise RuntimeError("__NEXT_DATA__ not found in Yad2 response")

    next_data = json.loads(m.group(1))
    queries = next_data["props"]["pageProps"]["dehydratedState"]["queries"]
    if not queries:
        raise RuntimeError("No queries in __NEXT_DATA__")

    feed_data = queries[0]["state"]["data"]
    return feed_data


def _extract_items(feed_data: dict) -> list[dict]:
    """Combine private + commercial + platinum/boost/solo items from feed."""
    items: list[dict] = []
    for bucket in ("private", "commercial", "platinum", "boost", "solo"):
        for item in feed_data.get(bucket, []):
            if isinstance(item, dict) and item.get("orderId"):
                items.append(item)
    return items


# ── Listing parser ───────────────────────────────────────────────────────────

def _nested_text(obj: object) -> Optional[str]:
    """Extract .text from a {id, text} object, or return the value as-is."""
    if isinstance(obj, dict):
        return obj.get("text")
    if isinstance(obj, str):
        return obj
    return None


def _nested_id(obj: object) -> Optional[int]:
    if isinstance(obj, dict):
        return obj.get("id")
    return None


def _parse_listing(item: dict) -> Yad2Listing:
    order_id = str(item.get("orderId", ""))
    token = str(item.get("token") or "")
    scraped_at = datetime.now(timezone.utc).isoformat()

    raw_price = item.get("price")
    try:
        price = int(str(raw_price).replace(",", "").replace(" ", "")) if raw_price else None
    except (ValueError, TypeError):
        price = None

    # km is NOT in the list feed — fetched separately via _enrich_km_batch()
    km: Optional[int] = item.get("km")  # will be None from list feed, filled in later

    cover: Optional[str] = None
    meta = item.get("metaData", {})
    if isinstance(meta, dict):
        images = meta.get("images") or []
        cover = images[0] if images else meta.get("coverImage")

    # Determine dealer vs private: the bucket key is the signal, but we don't
    # have it here. Use customer.agencyName presence as the reliable indicator.
    customer = item.get("customer", {})
    is_agent = bool(isinstance(customer, dict) and customer.get("agencyName"))

    # hand: {id: 1, text: "יד ראשונה"} — use id directly
    hand_obj = item.get("hand", {})
    hand = _nested_id(hand_obj)

    year_obj = item.get("vehicleDates", {})
    year = year_obj.get("yearOfProduction") if isinstance(year_obj, dict) else None

    engine_type_text = _nested_text(item.get("engineType"))
    gear_box_obj = item.get("gearBox")
    gear_box = _nested_text(gear_box_obj)

    color_obj = item.get("color")
    color_en = _nested_text(color_obj)

    body_obj = item.get("bodyType")
    body_type = _nested_text(body_obj)

    area_obj = item.get("address", {})
    city_en: Optional[str] = None
    if isinstance(area_obj, dict):
        city_en = area_obj.get("area", {}).get("text") if isinstance(area_obj.get("area"), dict) else None

    return Yad2Listing(
        listing_id=order_id,
        url=f"https://www.yad2.co.il/vehicles/item/{token or order_id}",
        is_agent=is_agent,
        manufacturer_en=_nested_text(item.get("manufacturer")),
        model_en=_nested_text(item.get("model")),
        sub_model=_nested_text(item.get("subModel")),
        year=year,
        km=km,
        hand=hand,
        color_en=color_en,
        engine_volume=item.get("engineVolume"),
        horse_power=item.get("horsePower"),
        gear_box=gear_box,
        engine_type=engine_type_text,
        seats=item.get("seats"),
        doors=item.get("doors"),
        body_type=body_type,
        city_en=city_en,
        area_en=city_en,
        price=price,
        currency="ILS",
        cover_image=cover,
        listing_description=None,
        test_date=None,
        updated_at=item.get("updatedAt"),
        scraped_at=scraped_at,
    )


# ── Analysis ─────────────────────────────────────────────────────────────────

def _filter_outliers(prices: list[float]) -> tuple[float, float]:
    """
    Two-pass outlier removal:
    Pass 1: Wide IQR (3×) to kill extreme junk (₪2k listings, fat-finger prices).
    Pass 2: Tight median ±40% window on the remaining prices for a clean market range.
    Returns (lower_bound, upper_bound).
    """
    if len(prices) < 4:
        return (0, float("inf"))

    # Pass 1 — 3×IQR to remove extreme outliers
    s = sorted(prices)
    mid = len(s) // 2
    q1 = statistics.median(s[:mid])
    q3 = statistics.median(s[mid:] if len(s) % 2 == 0 else s[mid + 1:])
    iqr = q3 - q1
    p1_lo = q1 - 3.0 * iqr
    p1_hi = q3 + 3.0 * iqr
    pass1 = [p for p in prices if p1_lo <= p <= p1_hi]

    if len(pass1) < 4:
        pass1 = prices  # fallback if too aggressive

    # Pass 2 — tight ±40% of median on the pass-1 set
    med = statistics.median(pass1)
    lo = med * 0.60
    hi = med * 1.40
    return (lo, hi)


def _sub_model_match(listing_sub: Optional[str], car_sub: Optional[str]) -> float:
    """
    Compare listing sub_model against car sub_model.
    Returns a weight multiplier: 2.5 exact, 1.5 partial keyword, 1.0 no info.
    """
    if not listing_sub or not car_sub:
        return 1.0
    l = listing_sub.upper().strip()
    c = car_sub.upper().strip()
    if l == c:
        return 2.5
    # Check if any keyword token from car sub_model appears in listing sub_model
    tokens = [t for t in re.split(r"[\s\-/]+", c) if len(t) >= 2]
    if any(t in l for t in tokens):
        return 1.5
    # Mismatched trim: slight penalty so cross-trim listings matter less
    return 0.6


def _similarity_weight(listing: Yad2Listing, car: MyCar) -> float:
    """
    Score how similar a listing is to the user's car.
    Returns a weight >= 0.6 (up to ~12.0 = perfect trim/year/engine/hand match).
    Factors: sub_model/trim match, year match, engine volume match, hand (owner count) match.
    """
    weight = 1.0
    # Sub-model / trim: most impactful factor (LX vs EX vs GT can differ ₪10k+)
    weight *= _sub_model_match(listing.sub_model, car.sub_model)
    # Exact year: 2x boost; ±1 year: 1.5x
    if listing.year and car.year:
        diff = abs(int(listing.year) - int(car.year))
        if diff == 0:
            weight *= 2.0
        elif diff == 1:
            weight *= 1.5
    # Engine volume match (within 100cc): 1.5x boost
    if listing.engine_volume and car.engine_volume:
        try:
            if abs(int(listing.engine_volume) - int(car.engine_volume)) <= 100:
                weight *= 1.5
        except (ValueError, TypeError):
            pass
    # Same owner count (hand): 1.3x boost
    if listing.hand and car.hand:
        try:
            if int(listing.hand) == int(car.hand):
                weight *= 1.3
        except (ValueError, TypeError):
            pass
    return weight


def _weighted_median(values: list[float], weights: list[float]) -> float:
    """Compute weighted median."""
    pairs = sorted(zip(values, weights), key=lambda x: x[0])
    total = sum(w for _, w in pairs)
    cumulative = 0.0
    for val, w in pairs:
        cumulative += w
        if cumulative >= total / 2:
            return val
    return pairs[-1][0]


def _compute_analysis(listings: list[Yad2Listing], car: Optional[MyCar] = None) -> MarketAnalysis:
    all_prices = [l.price for l in listings if l.price and l.price > 0]

    # Remove price outliers with two-pass filter
    if len(all_prices) >= 4:
        lo, hi = _filter_outliers(all_prices)
        clean_listings = [l for l in listings if l.price and lo <= l.price <= hi]
        removed = len(listings) - len(clean_listings)
        if removed > 0:
            console.print(
                f"  [yellow]⚠ Removed {removed} outlier listings "
                f"(price outside ₪{lo:,.0f}–₪{hi:,.0f})[/]"
            )
    else:
        clean_listings = listings

    prices = [l.price for l in clean_listings if l.price and l.price > 0]
    kms = [l.km for l in clean_listings if l.km and l.km > 0]
    private = [l for l in clean_listings if not l.is_agent]
    agents = [l for l in clean_listings if l.is_agent]

    # Weighted stats: boost listings similar to user's car
    weighted_avg: Optional[float] = None
    weighted_median: Optional[float] = None
    if car and prices:
        priced = [l for l in clean_listings if l.price and l.price > 0]
        weights = [_similarity_weight(l, car) for l in priced]
        w_prices = [l.price for l in priced]
        total_w = sum(weights)
        weighted_avg = round(sum(p * w for p, w in zip(w_prices, weights)) / total_w, 0)
        weighted_median = round(_weighted_median(w_prices, weights), 0)
        similar_count = sum(1 for w in weights if w > 1.0)
        trim_match_count = sum(
            1 for l in priced
            if car.sub_model and l.sub_model
            and l.sub_model.upper().strip() == car.sub_model.upper().strip()
        )
        trim_label = f" | {trim_match_count} exact trim '{car.sub_model}' matches" if car.sub_model else ""
        console.print(
            f"  [cyan]★ Weighted price (similarity-adjusted): "
            f"avg ₪{weighted_avg:,.0f} median ₪{weighted_median:,.0f} "
            f"({similar_count} close matches boosted{trim_label})[/]"
        )

    return MarketAnalysis(
        listings=clean_listings,
        count=len(clean_listings),
        avg_price=round(weighted_avg or statistics.mean(prices), 0) if prices else None,
        min_price=min(prices) if prices else None,
        max_price=max(prices) if prices else None,
        median_price=round(weighted_median or statistics.median(prices), 0) if prices else None,
        avg_km=round(statistics.mean(kms), 0) if kms else None,
        private_count=len(private),
        agent_count=len(agents),
    )


# ── km enrichment via individual item pages ──────────────────────────────────

KM_FETCH_LIMIT = 150  # fetch km for all scraped listings (concurrent)
KM_TIMEOUT     = 8    # per-request timeout


def _fetch_km_for_token(token: str) -> Optional[int]:
    """Fetch the item page for one token and extract km from __NEXT_DATA__."""
    if not token:
        return None
    url = f"https://www.yad2.co.il/vehicles/item/{token}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=KM_TIMEOUT)
        if resp.status_code != 200:
            return None
        m = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
            resp.text,
            re.DOTALL,
        )
        if not m:
            return None
        nd = json.loads(m.group(1))
        data = nd["props"]["pageProps"]["dehydratedState"]["queries"][0]["state"]["data"]
        km_raw = data.get("km")
        if km_raw is not None:
            try:
                return int(str(km_raw).replace(",", "").replace(" ", ""))
            except (ValueError, TypeError):
                return None
    except Exception:
        return None
    return None


def _enrich_km_batch(listings: list[Yad2Listing]) -> list[Yad2Listing]:
    """
    Fetch km for up to KM_FETCH_LIMIT listings concurrently.
    Mutates listing objects in-place (replaces km=None with actual value).
    """
    to_fetch = [l for l in listings if l.km is None and l.url]
    to_fetch = to_fetch[:KM_FETCH_LIMIT]
    if not to_fetch:
        return listings

    console.print(f"  🔍 Fetching km for {len(to_fetch)} listings (concurrent)…")

    # Extract token from URL: .../item/<token>
    def token_from_url(url: str) -> str:
        return url.rstrip("/").split("/")[-1]

    token_map = {token_from_url(l.url): l for l in to_fetch}
    # Pre-build index map: listing_id → position in listings list (O(1) lookup)
    idx_map = {l.listing_id: i for i, l in enumerate(listings)}

    fetched = 0
    with ThreadPoolExecutor(max_workers=15) as pool:
        futures = {pool.submit(_fetch_km_for_token, tok): tok for tok in token_map}
        for future in as_completed(futures):
            tok = futures[future]
            km_val = future.result()
            if km_val is not None and tok in token_map:
                listing = token_map[tok]
                # Yad2Listing is a Pydantic model — rebuild with km set
                updated = listing.model_copy(update={"km": km_val})
                idx = idx_map.get(listing.listing_id)
                if idx is not None:
                    listings[idx] = updated
                fetched += 1

    console.print(f"  [green]✓ km enriched for {fetched}/{len(to_fetch)} listings[/]")
    return listings


# ── Public entry point ────────────────────────────────────────────────────────

def scrape_market(
    car: MyCar,
    max_items: int = 200,
    exclude_agents: bool = False,
    debug: bool = False,
) -> MarketAnalysis:
    """
    Scrape Yad2 via __NEXT_DATA__ SSR pages.
    Resolves manufacturer/model names → numeric IDs, then paginates HTML pages.
    """
    year_range = f"{car.year - 2}-{car.year + 1}"
    console.print(
        f"[bold cyan]▶ Scraping Yad2 for {car.manufacturer} {car.model} "
        f"{year_range}…[/]"
    )

    mfr_id, model_id = _resolve_ids(car.manufacturer, car.model, year_range)

    all_listings: list[Yad2Listing] = []
    page = 1
    total_pages = 1

    while len(all_listings) < max_items and page <= total_pages:
        console.print(f"  📄 Page {page}/{total_pages}…", end=" ")
        try:
            feed_data = _fetch_page_html(mfr_id, model_id, year_range, page)
        except Exception as e:
            console.print(f"[red]Error fetching page {page}: {e}[/]")
            break

        pagination = feed_data.get("pagination", {})
        total_pages = pagination.get("pages", 1) or 1

        items = _extract_items(feed_data)
        console.print(f"found [green]{len(items)}[/] listings (total={pagination.get('total', '?')})")

        if debug:
            import pprint
            pprint.pprint(feed_data)

        if not items:
            console.print("  🏁 No items on this page.")
            break

        for item in items:
            if len(all_listings) >= max_items:
                break
            # Model guard: if we resolved a model_id, skip items with a different model
            if model_id:
                item_model_id = str(_nested_id(item.get("model")) or "")
                if item_model_id and item_model_id != model_id:
                    continue
            listing = _parse_listing(item)
            if exclude_agents and listing.is_agent:
                continue
            all_listings.append(listing)

        if page >= total_pages:
            console.print("  🏁 Reached last page.")
            break

        page += 1
        time.sleep(0.8)

    # Enrich km from individual item pages (not in list feed)
    all_listings = _enrich_km_batch(all_listings)

    analysis = _compute_analysis(all_listings, car=car)
    console.print(f"  [green]✓ Scraped {len(all_listings)} listings total[/]")
    return analysis
