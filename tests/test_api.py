"""Tests for FastAPI endpoints using TestClient (no real network calls)."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from car_seller.models import MyCar, MarketAnalysis, Yad2Listing
from car_seller.api import _load_cars, _save_cars, CARS_FILE


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self, api_client):
        resp = api_client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ── _load_cars / _save_cars helpers ───────────────────────────────────────────

class TestCarsFileHelpers:
    def test_load_cars_empty_when_no_file(self, tmp_path, monkeypatch):
        monkeypatch.setattr("car_seller.api.CARS_FILE", tmp_path / "nonexistent.json")
        from car_seller import api as api_mod
        original = api_mod.CARS_FILE
        api_mod.CARS_FILE = tmp_path / "nonexistent.json"
        result = _load_cars()
        api_mod.CARS_FILE = original
        assert result == []

    def test_save_and_load_roundtrip(self, tmp_path, monkeypatch):
        import car_seller.api as api_mod
        original = api_mod.CARS_FILE
        api_mod.CARS_FILE = tmp_path / "cars.json"
        try:
            cars = [{"make": "Toyota", "model": "Corolla"}]
            _save_cars(cars)
            loaded = _load_cars()
            assert loaded == cars
        finally:
            api_mod.CARS_FILE = original

    def test_load_cars_returns_empty_on_corrupt_json(self, tmp_path, monkeypatch):
        import car_seller.api as api_mod
        bad = tmp_path / "bad.json"
        bad.write_text("NOT JSON", encoding="utf-8")
        original = api_mod.CARS_FILE
        api_mod.CARS_FILE = bad
        result = _load_cars()
        api_mod.CARS_FILE = original
        assert result == []


# ── GET /api/plate/{plate} ────────────────────────────────────────────────────

class TestPlateEndpoint:
    def _plate_result(self):
        return {
            "plate": "1234567",
            "manufacturer_heb": "סקודה",
            "manufacturer_en": "Skoda",
            "model_heb": "OCTAVIA",
            "model_en": "OCTAVIA",
            "commercial_name": "OCTAVIA",
            "year": 2018,
            "color_heb": "כסף",
            "color_en": "Silver",
            "fuel_type_heb": "בנזין",
            "fuel_type_en": "Petrol",
            "engine_volume": None,
            "body_type_heb": "",
            "body_type_en": None,
            "doors": None,
            "hand": None,
            "ownership_type": "פרטי",
            "drive_type": "",
            "city": "",
            "trim": "",
            "vin": "",
            "last_test_date": "",
            "license_expiry": "",
            "first_registration": "",
            "tire_front": "",
            "tire_rear": "",
            "pollution_group": None,
            "raw": {},
        }

    @patch("car_seller.api.lookup_plate")
    def test_plate_found_returns_200(self, mock_lookup, api_client):
        mock_lookup.return_value = self._plate_result()
        resp = api_client.get("/api/plate/1234567")
        assert resp.status_code == 200
        data = resp.json()
        assert data["manufacturer_en"] == "Skoda"
        assert data["year"] == 2018

    @patch("car_seller.api.lookup_plate")
    def test_plate_not_found_returns_404(self, mock_lookup, api_client):
        mock_lookup.return_value = None
        resp = api_client.get("/api/plate/9999999")
        assert resp.status_code == 404

    @patch("car_seller.api.lookup_plate")
    def test_plate_api_error_returns_502(self, mock_lookup, api_client):
        mock_lookup.side_effect = RuntimeError("data.gov.il timeout")
        resp = api_client.get("/api/plate/1234567")
        assert resp.status_code == 502
        assert "timeout" in resp.json()["detail"]

    @patch("car_seller.api.lookup_plate")
    def test_plate_dashes_accepted(self, mock_lookup, api_client):
        mock_lookup.return_value = self._plate_result()
        resp = api_client.get("/api/plate/123-4567")
        assert resp.status_code == 200


# ── GET /api/history/{plate} ──────────────────────────────────────────────────

class TestHistoryEndpoint:
    @patch("car_seller.api.get_vehicle_history")
    def test_history_returns_data(self, mock_hist, api_client):
        mock_hist.return_value = {"tests": [{"date": "2024-01-01", "km": 80000}]}
        resp = api_client.get("/api/history/1234567")
        assert resp.status_code == 200
        assert "tests" in resp.json()

    @patch("car_seller.api.get_vehicle_history")
    def test_history_error_returns_502(self, mock_hist, api_client):
        mock_hist.side_effect = Exception("network error")
        resp = api_client.get("/api/history/1234567")
        assert resp.status_code == 502


# ── POST /api/parse-license ───────────────────────────────────────────────────

class TestParseLicenseEndpoint:
    def test_non_pdf_rejected(self, api_client):
        resp = api_client.post(
            "/api/parse-license",
            files={"file": ("document.txt", b"text content", "text/plain")},
        )
        assert resp.status_code == 400
        assert "PDF" in resp.json()["detail"]

    @patch("car_seller.api.parse_license_pdf")
    def test_pdf_parse_error_returns_422(self, mock_parse, api_client):
        mock_parse.side_effect = Exception("corrupted PDF")
        resp = api_client.post(
            "/api/parse-license",
            files={"file": ("license.pdf", b"%PDF-fake", "application/pdf")},
        )
        assert resp.status_code == 422

    @patch("car_seller.api.parse_license_pdf")
    def test_valid_pdf_returns_parsed_data(self, mock_parse, api_client):
        mock_parse.return_value = {"manufacturer": "Skoda", "model": "Octavia", "year": 2018}
        resp = api_client.post(
            "/api/parse-license",
            files={"file": ("license.pdf", b"%PDF-1.4 content", "application/pdf")},
        )
        assert resp.status_code == 200
        assert resp.json()["manufacturer"] == "Skoda"


# ── POST /api/analyze ─────────────────────────────────────────────────────────

class TestAnalyzeEndpoint:
    def _analyze_payload(self, **overrides):
        base = {
            "manufacturer": "Skoda",
            "model": "Octavia",
            "year": 2018,
            "km": 87000,
            "hand": 2,
        }
        base.update(overrides)
        return base

    def _mock_market(self, sample_listings) -> MarketAnalysis:
        return MarketAnalysis(
            listings=sample_listings,
            count=len(sample_listings),
            avg_price=92000,
            min_price=70000,
            max_price=120000,
            median_price=90000,
            avg_km=91000,
            private_count=11,
            agent_count=4,
        )

    @patch("car_seller.api.generate_selling_plan")
    @patch("car_seller.api.lookup_official_price")
    @patch("car_seller.api.scrape_market")
    def test_analyze_success(self, mock_scrape, mock_price, mock_plan, api_client, sample_listings):
        mock_scrape.return_value = self._mock_market(sample_listings)
        mock_price.return_value = 150000
        mock_plan.return_value = "# Plan\n- Buy low sell high"

        resp = api_client.post("/api/analyze", json=self._analyze_payload())
        assert resp.status_code == 200
        data = resp.json()
        assert "car" in data
        assert "market" in data
        assert "selling_plan" in data
        assert data["official_price"] == 150000
        assert data["car"]["manufacturer"] == "Skoda"

    @patch("car_seller.api.scrape_market")
    def test_analyze_scrape_error_returns_502(self, mock_scrape, api_client):
        mock_scrape.side_effect = Exception("Yad2 blocked")
        resp = api_client.post("/api/analyze", json=self._analyze_payload())
        assert resp.status_code == 502
        assert "Yad2 scrape error" in resp.json()["detail"]

    @patch("car_seller.api.generate_selling_plan")
    @patch("car_seller.api.lookup_official_price")
    @patch("car_seller.api.scrape_market")
    def test_analyze_official_price_failure_still_succeeds(
        self, mock_scrape, mock_price, mock_plan, api_client, sample_listings
    ):
        mock_scrape.return_value = self._mock_market(sample_listings)
        mock_price.side_effect = Exception("not found")
        mock_plan.return_value = "# Plan"

        resp = api_client.post("/api/analyze", json=self._analyze_payload())
        assert resp.status_code == 200
        assert resp.json()["official_price"] is None

    def test_analyze_missing_required_field(self, api_client):
        resp = api_client.post("/api/analyze", json={"manufacturer": "Toyota"})
        assert resp.status_code == 422

    @patch("car_seller.api.generate_selling_plan")
    @patch("car_seller.api.lookup_official_price")
    @patch("car_seller.api.scrape_market")
    def test_analyze_market_data_in_response(
        self, mock_scrape, mock_price, mock_plan, api_client, sample_listings
    ):
        mock_scrape.return_value = self._mock_market(sample_listings)
        mock_price.return_value = None
        mock_plan.return_value = "plan"

        resp = api_client.post("/api/analyze", json=self._analyze_payload())
        market = resp.json()["market"]
        assert market["count"] == len(sample_listings)
        assert market["avg_price"] == 92000


# ── POST /api/chat ────────────────────────────────────────────────────────────

class TestChatEndpoint:
    def _payload(self, message="What price should I ask?", **kw):
        return {"message": message, **kw}

    def test_no_openai_key_returns_503(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "")
        resp = api_client.post("/api/chat", json=self._payload())
        assert resp.status_code == 503

    def test_placeholder_key_returns_503(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "your_openai_api_key_here")
        resp = api_client.post("/api/chat", json=self._payload())
        assert resp.status_code == 503

    def test_chat_returns_reply(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Ask ₪95,000"))]
        )
        with patch("openai.OpenAI", return_value=mock_client):
            resp = api_client.post("/api/chat", json=self._payload(
                car={"manufacturer": "Skoda", "model": "Octavia", "year": 2018, "km": 87000},
                market={"count": 15, "avg_price": 92000, "median_price": 90000},
            ))
        assert resp.status_code == 200
        assert "reply" in resp.json()

    def test_chat_openai_error_returns_502(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-real-key")
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API down")
        with patch("openai.OpenAI", return_value=mock_client):
            resp = api_client.post("/api/chat", json=self._payload())
        assert resp.status_code == 502

    def test_chat_with_full_context(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Good price"))]
        )
        with patch("openai.OpenAI", return_value=mock_client):
            resp = api_client.post("/api/chat", json=self._payload(
                car={
                    "manufacturer": "Skoda", "model": "Octavia", "year": 2018,
                    "km": 87000, "hand": 2, "asking_price": 95000,
                    "gear_box": "Automatic", "engine_type": "Petrol",
                },
                market={"count": 15, "avg_price": 92000, "median_price": 90000,
                        "min_price": 70000, "max_price": 120000, "avg_km": 91000,
                        "private_count": 11, "agent_count": 4},
                official_price=150000,
                history=[{"test_date": "2024-01-01", "km": 80000}],
            ))
        assert resp.status_code == 200


# ── GET/POST/DELETE /api/cars ─────────────────────────────────────────────────

class TestCarsEndpoints:
    def _use_tmp_cars(self, monkeypatch, tmp_path):
        import car_seller.api as api_mod
        monkeypatch.setattr(api_mod, "CARS_FILE", tmp_path / "cars.json")

    def test_list_cars_empty(self, api_client, monkeypatch, tmp_path):
        self._use_tmp_cars(monkeypatch, tmp_path)
        resp = api_client.get("/api/cars")
        assert resp.status_code == 200
        assert resp.json()["cars"] == []

    def test_save_car(self, api_client, monkeypatch, tmp_path):
        self._use_tmp_cars(monkeypatch, tmp_path)
        resp = api_client.post("/api/cars", json={"car": {"make": "Toyota", "model": "Corolla"}})
        assert resp.status_code == 201
        assert resp.json()["saved"] is True
        assert resp.json()["total"] == 1

    def test_save_and_list(self, api_client, monkeypatch, tmp_path):
        self._use_tmp_cars(monkeypatch, tmp_path)
        api_client.post("/api/cars", json={"car": {"make": "Kia"}})
        api_client.post("/api/cars", json={"car": {"make": "Honda"}})
        resp = api_client.get("/api/cars")
        assert len(resp.json()["cars"]) == 2

    def test_delete_car(self, api_client, monkeypatch, tmp_path):
        self._use_tmp_cars(monkeypatch, tmp_path)
        api_client.post("/api/cars", json={"car": {"make": "Toyota"}})
        api_client.post("/api/cars", json={"car": {"make": "Kia"}})
        resp = api_client.delete("/api/cars/0")
        assert resp.status_code == 200
        remaining = api_client.get("/api/cars").json()["cars"]
        assert len(remaining) == 1
        assert remaining[0]["make"] == "Kia"

    def test_delete_out_of_range_returns_404(self, api_client, monkeypatch, tmp_path):
        self._use_tmp_cars(monkeypatch, tmp_path)
        resp = api_client.delete("/api/cars/99")
        assert resp.status_code == 404

    def test_delete_negative_index_returns_404(self, api_client, monkeypatch, tmp_path):
        self._use_tmp_cars(monkeypatch, tmp_path)
        api_client.post("/api/cars", json={"car": {"make": "Toyota"}})
        resp = api_client.delete("/api/cars/-1")
        assert resp.status_code == 404
