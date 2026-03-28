"""Tests for plate_lookup module — map helpers and plate normalisation."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest
import httpx

from car_seller.plate_lookup import _map, lookup_plate, _COLOR_MAP, _FUEL_MAP, _BODY_MAP, _MANUF_MAP


# ── _map helper ───────────────────────────────────────────────────────────────

class TestMapHelper:
    def test_known_hebrew_color(self):
        assert _map(_COLOR_MAP, "לבן") == "White"

    def test_known_hebrew_fuel(self):
        assert _map(_FUEL_MAP, "בנזין") == "Petrol"

    def test_known_hebrew_body(self):
        assert _map(_BODY_MAP, "סדאן") == "Sedan"

    def test_known_manufacturer(self):
        assert _map(_MANUF_MAP, "טויוטה") == "Toyota"

    def test_unknown_value_returned_as_is(self):
        assert _map(_COLOR_MAP, "כלשהו") == "כלשהו"

    def test_none_value_returns_none(self):
        assert _map(_COLOR_MAP, None) is None

    def test_empty_string_returns_none(self):
        assert _map(_COLOR_MAP, "") is None

    def test_substring_match_works(self):
        assert _map(_COLOR_MAP, "לבן מטאלי") == "White"

    def test_diesel_fuel(self):
        assert _map(_FUEL_MAP, "דיזל") == "Diesel"

    def test_electric_fuel(self):
        assert _map(_FUEL_MAP, "חשמל") == "Electric"

    def test_hybrid_fuel(self):
        assert _map(_FUEL_MAP, "היברידי") == "Hybrid"

    def test_suv_body(self):
        assert _map(_BODY_MAP, "ג'יפ") == "SUV"

    def test_hatchback_body(self):
        assert _map(_BODY_MAP, "האצ'בק") == "Hatchback"

    def test_bmw_manufacturer(self):
        assert _map(_MANUF_MAP, "ב.מ.וו") == "BMW"

    def test_skoda_manufacturer(self):
        assert _map(_MANUF_MAP, "סקודה") == "Skoda"

    def test_kia_manufacturer(self):
        assert _map(_MANUF_MAP, "קיה") == "Kia"


# ── lookup_plate ──────────────────────────────────────────────────────────────

class TestLookupPlate:
    def _api_response(self, records=None) -> dict:
        return {
            "success": True,
            "result": {
                "records": records or [{
                    "mispar_rechev": "1234567",
                    "tozeret_nm": "סקודה",
                    "degem_nm": "OCTAVIA",
                    "kinuy_mishari": "OCTAVIA 1.4 TSI",
                    "shnat_yitzur": "2018",
                    "tzeva_rechev": "כסף",
                    "sug_delek_nm": "בנזין",
                    "hanaa_nm": "קדמי",
                    "sug_guf_nm": "האצ'בק",
                    "mispar_dlatot": "5",
                    "moshav_nm": "תל אביב",
                    "baalut": "פרטי",
                    "ramat_gimur": "AMBITION",
                    "misgeret": "TMBJG7NE0J0123456",
                    "mivchan_acharon_dt": "2025-10-01",
                    "tokef_dt": "2026-10-10",
                    "moed_aliya_lakvish": "2018-03-01",
                    "zmig_kidmi": "205/55R16",
                    "zmig_ahori": "205/55R16",
                    "kvutzat_zihum": 7,
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

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_valid_plate_returns_dict(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result is not None
        assert result["plate"] == "1234567"

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_manufacturer_translated(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["manufacturer_en"] == "Skoda"

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_color_translated(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["color_en"] == "Silver"

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_fuel_translated(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["fuel_type_en"] == "Petrol"

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_year_parsed_as_int(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["year"] == 2018
        assert isinstance(result["year"], int)

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_plate_stripped_of_dashes(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("123-4567")
        assert result["plate"] == "1234567"

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_plate_stripped_of_spaces(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("123 4567")
        assert result["plate"] == "1234567"

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_no_records_returns_none(self, mock_client_cls):
        data = {"success": True, "result": {"records": []}}
        mock_client_cls.return_value = self._mock_httpx(data)
        result = lookup_plate("9999999")
        assert result is None

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_api_success_false_returns_none(self, mock_client_cls):
        data = {"success": False, "result": {"records": []}}
        mock_client_cls.return_value = self._mock_httpx(data)
        result = lookup_plate("1234567")
        assert result is None

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_network_error_raises_runtime_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("timeout")
        mock_client_cls.return_value = mock_client
        with pytest.raises(RuntimeError, match="data.gov.il API error"):
            lookup_plate("1234567")

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_vin_extracted(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["vin"] == "TMBJG7NE0J0123456"

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_pollution_group_extracted(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["pollution_group"] == 7

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_engine_volume_none_not_in_this_resource(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["engine_volume"] is None

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_hand_none_not_in_this_resource(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["hand"] is None

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_invalid_year_handled(self, mock_client_cls):
        records = self._api_response()["result"]["records"]
        records[0]["shnat_yitzur"] = "not-a-year"
        mock_client_cls.return_value = self._mock_httpx({"success": True, "result": {"records": records}})
        result = lookup_plate("1234567")
        assert result["year"] is None

    @patch("car_seller.plate_lookup.httpx.Client")
    def test_tire_info_extracted(self, mock_client_cls):
        mock_client_cls.return_value = self._mock_httpx(self._api_response())
        result = lookup_plate("1234567")
        assert result["tire_front"] == "205/55R16"
        assert result["tire_rear"] == "205/55R16"
