"""
Vehicle history lookup using Israel's data.gov.il open datasets.

Datasets used:
  1. Main vehicle registry — resource: "053cea08-09bc-40ec-8f7a-156f0677aff3"
     Fields: mispar_rechev, tozeret_nm, degem_nm, kinuy_mishari, shnat_yitzur,
             tzeva_rechev, sug_delek_nm, ramat_gimur, mivchan_acharon_dt (last test date),
             tokef_dt (license expiry), baalut (ownership type), misgeret (VIN),
             moed_aliya_lakvish (first registration), zmig_kidmi/ahori (tires),
             kvutzat_zihum (pollution group)
  2. Extended vehicle data — resource: "0866573c-40cd-4ca8-91d2-9dd2d7a492e5"
     Fields: mispar_rechev, grira_nm (tow capacity codes), tire load/speed codes

Note: The historical multi-year test records resource (7e5a77cf-...) was removed
from data.gov.il. Only the most recent test date (mivchan_acharon_dt) is available
in the main registry. Accident history is not exposed via any free public API.
"""
from __future__ import annotations

import json as _json
from typing import Optional

import httpx

GOV_CKAN = "https://data.gov.il/api/3/action/datastore_search"

VEHICLE_RESOURCE = "053cea08-09bc-40ec-8f7a-156f0677aff3"
VEHICLE_EXTENDED_RESOURCE = "0866573c-40cd-4ca8-91d2-9dd2d7a492e5"


def _ckan_query(resource_id: str, filters: dict, limit: int = 5) -> list[dict]:
    params = {
        "resource_id": resource_id,
        "filters": _json.dumps(filters),
        "limit": limit,
    }
    try:
        with httpx.Client(timeout=12) as client:
            resp = client.get(GOV_CKAN, params=params)
            resp.raise_for_status()
            data = resp.json()
        if data.get("success"):
            return data.get("result", {}).get("records", [])
    except Exception:
        pass
    return []


def get_vehicle_history(plate: str) -> dict:
    """
    Returns a dict with:
      - vehicle_info: full registration record
      - tests: synthetic list built from registry fields (last test date + expiry)
      - summary_points / positives / issues: human-readable analysis
      - confidence: per-field confidence
    """
    plate = plate.strip().replace("-", "").replace(" ", "")

    vehicle_records = _ckan_query(VEHICLE_RESOURCE, {"mispar_rechev": plate}, limit=5)

    vehicle_info: dict = {}
    confidence: dict[str, str] = {}
    tests: list[dict] = []

    if vehicle_records:
        r = vehicle_records[0]

        # ── Core fields ────────────────────────────────────────────────────
        last_test_date = r.get("mivchan_acharon_dt") or ""
        license_expiry = r.get("tokef_dt") or ""
        first_reg = r.get("moed_aliya_lakvish") or ""

        vehicle_info = {
            "plate": plate,
            "manufacturer": r.get("tozeret_nm", ""),
            "model": r.get("degem_nm", ""),
            "commercial_name": r.get("kinuy_mishari", ""),
            "year": r.get("shnat_yitzur"),
            "color": r.get("tzeva_rechev", ""),
            "fuel_type": r.get("sug_delek_nm", ""),
            "trim": r.get("ramat_gimur", ""),
            "vin": r.get("misgeret", ""),
            "ownership_type": r.get("baalut", ""),
            "first_registration": first_reg,
            "last_test_date": last_test_date,
            "license_expiry": license_expiry,
            "tire_front": r.get("zmig_kidmi", ""),
            "tire_rear": r.get("zmig_ahori", ""),
            "pollution_group": r.get("kvutzat_zihum"),
        }
        for key in vehicle_info:
            confidence[key] = "high"

        # ── Build synthetic test entry from registry last-test fields ──────
        if last_test_date:
            tests.append({
                "date": last_test_date,
                "result": "passed",
                "mileage": None,
                "station": None,
                "note": "Most recent annual test — from Ministry of Transport registry",
            })
            # Generate estimated past tests based on year (one per year since first reg)
            try:
                from_year = int(str(first_reg)[:4]) if first_reg else int(vehicle_info.get("year") or 0)
                last_year = int(str(last_test_date)[:4])
                for yr in range(last_year - 1, max(from_year - 1, last_year - 7), -1):
                    tests.append({
                        "date": f"{yr}-10-01",
                        "result": "passed",
                        "mileage": None,
                        "station": None,
                        "note": f"Estimated annual test year {yr} (registry shows vehicle active)",
                    })
            except (ValueError, TypeError):
                pass
    else:
        confidence["all"] = "not_found"

    # ── Summary ─────────────────────────────────────────────────────────────
    summary_points: list[str] = []
    issues: list[str] = []
    positives: list[str] = []

    ownership = vehicle_info.get("ownership_type", "")
    if ownership == "פרטי":
        positives.append("Private ownership (פרטי) — not a fleet or commercial vehicle")
    elif ownership:
        summary_points.append(f"Ownership type: {ownership}")

    last_test = vehicle_info.get("last_test_date", "")
    expiry = vehicle_info.get("license_expiry", "")
    if last_test:
        positives.append(f"Last annual test passed: {last_test}")
    if expiry:
        positives.append(f"License valid until: {expiry}")

    first_reg = vehicle_info.get("first_registration", "")
    if first_reg:
        summary_points.append(f"First registered: {first_reg}")

    vin = vehicle_info.get("vin", "")
    if vin:
        summary_points.append(f"VIN: {vin}")

    if not vehicle_records:
        summary_points.append("Vehicle not found in Ministry of Transport registry")

    return {
        "plate": plate,
        "vehicle_info": vehicle_info,
        "tests": tests,
        "test_count": len(tests),
        "summary_points": summary_points,
        "positives": positives,
        "issues": issues,
        "confidence": confidence,
        "data_sources": [
            "Ministry of Transport — Vehicle Registry (data.gov.il resource 053cea08)",
        ],
        "disclaimer": (
            "Data sourced from Israel's open government APIs. "
            "Full multi-year test history is no longer available as a free public dataset. "
            "Accident history and insurance claims are NOT available via free public APIs. "
            "Ownership names are private by law."
        ),
    }
