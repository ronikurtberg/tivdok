"""Tests for official_price module — variant resolution and lookup."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest
import httpx

from car_seller.models import MyCar
from car_seller.official_price import _variants, lookup_official_price


# ── _variants ──────────────────────────────────────────────────────────────────

class TestVariants:
    def test_known_manufacturer_english(self):
        v = _variants("Toyota")
        assert "Toyota" in v
        assert "טויוטה" in v

    def test_known_manufacturer_hebrew(self):
        v = _variants("טויוטה")
        assert "Toyota" in v

    def test_case_insensitive(self):
        v = _variants("toyota")
        assert "Toyota" in v

    def test_unknown_manufacturer_returns_self(self):
        v = _variants("UnknownBrand")
        assert v == ["UnknownBrand"]

    def test_skoda_variants(self):
        v = _variants("Skoda")
        assert "Skoda" in v
        assert "סקודה" in v

    def test_kia_variants(self):
        v = _variants("Kia")
        assert "Kia" in v
        assert "KIA" in v

    def test_vw_alias(self):
        v = _variants("Volkswagen")
        assert "VW" in v
        assert "Volkswagen" in v

    def test_byd_variants(self):
        v = _variants("BYD")
        assert "BYD" in v

    def test_tesla_variants(self):
        v = _variants("Tesla")
        assert "Tesla" in v


# ── lookup_official_price ─────────────────────────────────────────────────────

class TestLookupOfficialPrice:
    def _make_car(self, manufacturer="Skoda", model="Octavia", year=2018) -> MyCar:
        return MyCar(manufacturer=manufacturer, model=model, year=year, km=80000, hand=2)

    def _api_response(self, records=None) -> dict:
        return {
            "success": True,
            "result": {
                "records": records or [{
                    "shnat_yitzur": "2018",
                    "kinuy_mishari": "OCTAVIA 1.4 TSI",
                    "degem_mankal": "145000",
                }]
            }
        }

    def _mock_httpx(self, response_data: dict):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = response_data
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_resp
        return mock_client

    @patch("car_seller.official_price.httpx.Client")
    def test_returns_catalog_price(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        car = self._make_car()
        price = lookup_official_price(car)
        assert price == 145000

    @patch("car_seller.official_price.httpx.Client")
    def test_returns_none_when_no_records(self, mock_client_cls):
        data = {"success": True, "result": {"records": []}}
        mock_client_cls.return_value = self._mock_httpx(data)
        car = self._make_car()
        price = lookup_official_price(car)
        assert price is None

    @patch("car_seller.official_price.httpx.Client")
    def test_returns_none_when_api_fails(self, mock_client_cls):
        data = {"success": False, "result": {"records": []}}
        mock_client_cls.return_value = self._mock_httpx(data)
        car = self._make_car()
        price = lookup_official_price(car)
        assert price is None

    @patch("car_seller.official_price.httpx.Client")
    def test_returns_none_on_http_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("timeout")
        mock_client_cls.return_value = mock_client
        car = self._make_car()
        price = lookup_official_price(car)
        assert price is None

    @patch("car_seller.official_price.httpx.Client")
    def test_year_mismatch_falls_back_to_any_record(self, mock_client_cls):
        records = [
            {"shnat_yitzur": "2015", "kinuy_mishari": "OLD", "degem_mankal": "80000"},
        ]
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        car = self._make_car(year=2018)
        price = lookup_official_price(car)
        assert price == 80000

    @patch("car_seller.official_price.httpx.Client")
    def test_year_match_preferred(self, mock_client_cls):
        records = [
            {"shnat_yitzur": "2016", "kinuy_mishari": "OLD", "degem_mankal": "100000"},
            {"shnat_yitzur": "2018", "kinuy_mishari": "CURRENT", "degem_mankal": "145000"},
        ]
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        car = self._make_car(year=2018)
        price = lookup_official_price(car)
        assert price == 145000

    @patch("car_seller.official_price.httpx.Client")
    def test_mchir_dirugit_fallback_field(self, mock_client_cls):
        records = [{"shnat_yitzur": "2018", "kinuy_mishari": "X", "mchir_dirugit": "130000"}]
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        price = lookup_official_price(self._make_car())
        assert price == 130000

    @patch("car_seller.official_price.httpx.Client")
    def test_mchir_catalog_fallback_field(self, mock_client_cls):
        records = [{"shnat_yitzur": "2018", "kinuy_mishari": "X", "mchir_catalog": "120000"}]
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        price = lookup_official_price(self._make_car())
        assert price == 120000

    @patch("car_seller.official_price.httpx.Client")
    def test_price_with_comma_parsed(self, mock_client_cls):
        records = [{"shnat_yitzur": "2018", "kinuy_mishari": "X", "degem_mankal": "145,000"}]
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        price = lookup_official_price(self._make_car())
        assert price == 145000

    @patch("car_seller.official_price.httpx.Client")
    def test_skips_zero_price_record(self, mock_client_cls):
        records = [
            {"shnat_yitzur": "2018", "kinuy_mishari": "X", "degem_mankal": "0"},
            {"shnat_yitzur": "2018", "kinuy_mishari": "Y", "degem_mankal": "145000"},
        ]
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        price = lookup_official_price(self._make_car())
        assert price == 145000

    @patch("car_seller.official_price.httpx.Client")
    def test_unknown_manufacturer_tries_name_as_is(self, mock_client_cls):
        records = [{"shnat_yitzur": "2020", "kinuy_mishari": "X", "degem_mankal": "200000"}]
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        car = MyCar(manufacturer="UnknownBrand", model="SomeModel", year=2020, km=10000, hand=1)
        price = lookup_official_price(car)
        assert price == 200000
