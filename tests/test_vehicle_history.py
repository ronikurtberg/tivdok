"""Tests for vehicle_history module."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

from car_seller.vehicle_history import _ckan_query, get_vehicle_history


# ── _ckan_query ───────────────────────────────────────────────────────────────

class TestCkanQuery:
    def _mock_httpx(self, response_data: dict):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = response_data
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_resp
        return mock_client

    @patch("car_seller.vehicle_history.httpx.Client")
    def test_returns_records_on_success(self, mock_cls):
        mock_cls.return_value = self._mock_httpx({
            "success": True,
            "result": {"records": [{"mispar_rechev": "1234567"}]},
        })
        records = _ckan_query("resource-id", {"mispar_rechev": "1234567"})
        assert records == [{"mispar_rechev": "1234567"}]

    @patch("car_seller.vehicle_history.httpx.Client")
    def test_returns_empty_on_api_failure(self, mock_cls):
        mock_cls.return_value = self._mock_httpx({"success": False})
        records = _ckan_query("resource-id", {"mispar_rechev": "1234567"})
        assert records == []

    @patch("car_seller.vehicle_history.httpx.Client")
    def test_returns_empty_on_network_error(self, mock_cls):
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = Exception("timeout")
        mock_cls.return_value = mock_client
        records = _ckan_query("resource-id", {"mispar_rechev": "1234567"})
        assert records == []


# ── get_vehicle_history ───────────────────────────────────────────────────────

class TestGetVehicleHistory:
    def _vehicle_record(self, **overrides) -> dict:
        base = {
            "mispar_rechev": "1234567",
            "tozeret_nm": "סקודה",
            "degem_nm": "OCTAVIA",
            "kinuy_mishari": "OCTAVIA 1.4 TSI",
            "shnat_yitzur": "2018",
            "tzeva_rechev": "כסף",
            "sug_delek_nm": "בנזין",
            "ramat_gimur": "AMBITION",
            "misgeret": "TMBJG7NE0J0123456",
            "baalut": "פרטי",
            "moed_aliya_lakvish": "2018-03-01",
            "mivchan_acharon_dt": "2025-10-01",
            "tokef_dt": "2026-10-10",
            "zmig_kidmi": "205/55R16",
            "zmig_ahori": "205/55R16",
            "kvutzat_zihum": 7,
        }
        base.update(overrides)
        return base

    @patch("car_seller.vehicle_history._ckan_query")
    def test_returns_dict_with_required_keys(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        for key in ("plate", "vehicle_info", "tests", "test_count", "summary_points",
                    "positives", "issues", "confidence", "data_sources", "disclaimer"):
            assert key in result, f"Missing key: {key}"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_plate_normalised(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("123-4567")
        assert result["plate"] == "1234567"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_vehicle_info_populated(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        info = result["vehicle_info"]
        assert info["manufacturer"] == "סקודה"
        assert info["vin"] == "TMBJG7NE0J0123456"
        assert info["year"] == "2018"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_tests_list_built_from_last_test_date(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        assert result["test_count"] > 0
        assert any("2025-10-01" in t["date"] for t in result["tests"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_estimated_past_tests_generated(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        estimated = [t for t in result["tests"] if "Estimated" in (t.get("note") or "")]
        assert len(estimated) > 0

    @patch("car_seller.vehicle_history._ckan_query")
    def test_private_ownership_adds_positive(self, mock_query):
        mock_query.return_value = [self._vehicle_record(baalut="פרטי")]
        result = get_vehicle_history("1234567")
        assert any("Private" in p for p in result["positives"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_last_test_date_in_positives(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        assert any("2025-10-01" in p for p in result["positives"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_license_expiry_in_positives(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        assert any("2026-10-10" in p for p in result["positives"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_not_found_returns_empty_vehicle_info(self, mock_query):
        mock_query.return_value = []
        result = get_vehicle_history("9999999")
        assert result["vehicle_info"] == {}
        assert result["test_count"] == 0
        assert result["confidence"] == {"all": "not_found"}

    @patch("car_seller.vehicle_history._ckan_query")
    def test_not_found_summary_mentions_not_found(self, mock_query):
        mock_query.return_value = []
        result = get_vehicle_history("9999999")
        assert any("not found" in s.lower() for s in result["summary_points"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_no_last_test_date_no_tests(self, mock_query):
        mock_query.return_value = [self._vehicle_record(mivchan_acharon_dt="")]
        result = get_vehicle_history("1234567")
        assert result["test_count"] == 0

    @patch("car_seller.vehicle_history._ckan_query")
    def test_vin_in_summary_points(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        assert any("TMBJG7NE0J0123456" in s for s in result["summary_points"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_first_registration_in_summary(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        assert any("2018-03-01" in s for s in result["summary_points"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_non_private_ownership_in_summary(self, mock_query):
        mock_query.return_value = [self._vehicle_record(baalut="ליסינג")]
        result = get_vehicle_history("1234567")
        assert any("ליסינג" in s for s in result["summary_points"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_confidence_high_for_found_record(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        for key, val in result["confidence"].items():
            assert val == "high", f"Expected high confidence for {key}, got {val}"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_disclaimer_always_present(self, mock_query):
        mock_query.return_value = []
        result = get_vehicle_history("1234567")
        assert len(result["disclaimer"]) > 20

    @patch("car_seller.vehicle_history._ckan_query")
    def test_data_sources_list(self, mock_query):
        mock_query.return_value = [self._vehicle_record()]
        result = get_vehicle_history("1234567")
        assert isinstance(result["data_sources"], list)
        assert len(result["data_sources"]) >= 1
