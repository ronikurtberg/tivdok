"""
Yad2 Car Listings Scraper — Direct API (free, no Apify)
Hits Yad2's internal JSON API directly. Fast and reliable.

Requirements:
    pip install requests pandas

Usage (defaults to Mazda CX-5 2018-2019 example):
    python yad2_scraper.py

Custom search via env or editing PARAMS below:
    python yad2_scraper.py --debug    # print raw API response and exit
"""

import argparse
import json
import time
from datetime import datetime

import requests
import pandas as pd

# ── Yad2 API filters ──────────────────────────────────────────────────────────
# Manufacturer IDs: found in Yad2 URL when you filter by manufacturer.
# Common examples (edit as needed):
#   Toyota=1, Hyundai=16, Kia=10, Mazda=40, Honda=18, Nissan=51
#   Subaru=37, Volkswagen=26, BMW=7, Mercedes=3, Skoda=35
#
# Model IDs: found in the Yad2 URL after selecting a model.
# Example: CX-5 = 10547 (verify on yad2.co.il for your exact model)

PARAMS = {
    "manufacturer": "40",       # Mazda
    "model":        "10547",    # CX-5 (verify on Yad2!)
    "year":         "2018-2019",
    "price":        "30000--1", # 30,000+ ILS (no upper limit)
    "km":           "100000-130000",
    "engineval":    "1300-1500",
    "hand":         "2-3",
    "gearBox":      "102",      # 102 = automatic
    "vehicleType":  "cars",
    "page":         1,
}

API_URL = "https://gw.yad2.co.il/feed-search-legacy/vehicles/cars"

HEADERS = {
    "User-Agent":       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":           "application/json, text/plain, */*",
    "Accept-Language":  "he-IL,he;q=0.9,en-US;q=0.8",
    "Referer":          "https://www.yad2.co.il/",
    "Origin":           "https://www.yad2.co.il",
}


def fetch_page(page: int) -> dict:
    params = {**PARAMS, "page": page}
    resp = requests.get(API_URL, headers=HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def parse_listing(item: dict) -> dict:
    """Flatten the fields we care about from a raw listing dict."""
    raw_price = item.get("price", "")
    try:
        price = int(str(raw_price).replace(",", "").replace(" ", "")) if raw_price else ""
    except (ValueError, TypeError):
        price = raw_price

    raw_km = item.get("km", "")
    try:
        km = int(str(raw_km).replace(",", "").replace(" ", "")) if raw_km else ""
    except (ValueError, TypeError):
        km = raw_km

    images = item.get("image_urls") or []
    cover = images[0] if images else item.get("coverImage") or item.get("image", "")

    return {
        "listingId":    item.get("id") or item.get("orderId", ""),
        "url":          f"https://www.yad2.co.il/vehicles/item/{item.get('id', '')}",
        "title":        item.get("title", ""),
        "manufacturer": item.get("manufacturer", ""),
        "model":        item.get("model", ""),
        "subModel":     item.get("subModel", ""),
        "year":         item.get("year", ""),
        "km":           km,
        "hand":         item.get("hand", ""),
        "price":        price,
        "engineVolume": item.get("engineVolume", ""),
        "horsePower":   item.get("horsePower", ""),
        "gearBox":      item.get("gearBox", ""),
        "engineType":   item.get("engineType", ""),
        "color":        item.get("color", ""),
        "city":         item.get("city", ""),
        "area":         item.get("area", ""),
        "isAgent":      item.get("isAgent", ""),
        "testDate":     item.get("testDate", ""),
        "updatedAt":    item.get("updatedAt", ""),
        "description":  item.get("info3", "") or item.get("listingDescription", ""),
        "coverImage":   cover,
    }


def scrape_all() -> list[dict]:
    all_listings = []
    page = 1

    print("🚗 Starting Yad2 API scrape...\n")

    while True:
        print(f"  📄 Fetching page {page}...", end=" ", flush=True)
        try:
            data = fetch_page(page)
        except requests.HTTPError as e:
            print(f"HTTP error: {e}")
            break
        except Exception as e:
            print(f"Error: {e}")
            break

        # ── Try to find listings in common response shapes ────────────────────
        feed = (
            data.get("data", {}).get("feed", {}).get("feed_items")
            or data.get("data", {}).get("items")
            or data.get("feed_items")
            or data.get("items")
            or []
        )
        listings = [i for i in feed if isinstance(i, dict) and i.get("id")]

        print(f"found {len(listings)} listings")

        if not listings:
            print("  🏁 No more listings — done.")
            break

        for item in listings:
            all_listings.append(parse_listing(item))

        # ── Check pagination ──────────────────────────────────────────────────
        pagination = (
            data.get("data", {}).get("pagination")
            or data.get("pagination")
            or {}
        )
        total_pages = pagination.get("last_page") or pagination.get("totalPages") or 1
        print(f"     (page {page}/{total_pages})")

        if page >= total_pages:
            print("  🏁 Reached last page — done.")
            break

        page += 1
        time.sleep(1)

    return all_listings


def save(listings: list[dict]):
    if not listings:
        print("\n⚠️  No listings found. The API shape may have changed.")
        print("    → Run with --debug to inspect the raw API response.")
        return

    df = pd.DataFrame(listings)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    csv_path  = f"yad2_cars_{ts}.csv"
    json_path = f"yad2_cars_{ts}.json"

    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(listings, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Scraped {len(listings)} listings")
    print(f"   📊 CSV  → {csv_path}")
    print(f"   📋 JSON → {json_path}")
    print("\n── Preview ──────────────────────────────────────────────────────")
    cols = ["title", "year", "km", "hand", "price", "city", "url"]
    print(df[[c for c in cols if c in df.columns]].head(10).to_string(index=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Yad2 car listings directly.")
    parser.add_argument("--debug", action="store_true", help="Print raw API response and exit")
    args = parser.parse_args()

    if args.debug:
        import pprint
        print("── Raw API response (page 1) ────────────────────────────────────")
        pprint.pprint(fetch_page(1))
    else:
        listings = scrape_all()
        save(listings)
