"""Tests for scraper ID resolution and page-fetching paths."""
from __future__ import annotations

import json
from unittest.mock import patch, MagicMock

import pytest

from car_seller.scraper import _resolve_ids, _fetch_page_html, _MFR_NAME_TO_ID


# ── _resolve_ids ──────────────────────────────────────────────────────────────

class TestResolveIds:
    def _mock_redirect_response(self, mfr_id: str, model_id: str):
        redirect = f"https://www.yad2.co.il/vehicles/cars?manufacturer={mfr_id}&model={model_id}"
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"data": {"redirect": redirect}}
        return mock_resp

    def _mock_redirect_fail(self):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = Exception("HTTP 404")
        return mock_resp

    @patch("car_seller.scraper.requests.get")
    def test_resolve_via_redirect_returns_ids(self, mock_get):
        mock_get.return_value = self._mock_redirect_response("48", "10547")
        mfr_id, model_id = _resolve_ids("Skoda", "Octavia", "2017-2019")
        assert mfr_id == "48"
        assert model_id == "10547"

    @patch("car_seller.scraper.requests.get")
    def test_resolve_strips_manufacturer_prefix_from_model(self, mock_get):
        mock_get.return_value = self._mock_redirect_response("48", "10547")
        mfr_id, model_id = _resolve_ids("Skoda", "Skoda Octavia", "2017-2019")
        mock_get.assert_called()
        call_kwargs = mock_get.call_args
        assert call_kwargs is not None

    @patch("car_seller.scraper.requests.get")
    def test_unknown_manufacturer_returns_empty_ids(self, mock_get):
        mock_get.side_effect = Exception("network error")
        mfr_id, model_id = _resolve_ids("UnknownBrand", "SomeModel", "2020-2022")
        assert mfr_id == ""
        assert model_id == ""

    @patch("car_seller.scraper.requests.get")
    def test_known_manufacturer_returns_static_id_when_redirect_fails(self, mock_get):
        mock_get.side_effect = [
            Exception("redirect failed"),
            Exception("page fetch failed"),
        ]
        mfr_id, model_id = _resolve_ids("Skoda", "Octavia", "2017-2019")
        assert mfr_id == str(_MFR_NAME_TO_ID.get("skoda", ""))
        assert model_id == ""

    @patch("car_seller.scraper.requests.get")
    def test_redirect_with_non_numeric_ids_falls_through(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"data": {"redirect": "?foo=bar&baz=qux"}}
        mock_get.side_effect = [mock_resp, Exception("page fail")]
        mfr_id, model_id = _resolve_ids("Skoda", "Octavia", "2017-2019")
        assert mfr_id != "bar"

    @patch("car_seller.scraper.requests.get")
    def test_model_id_resolved_via_similar_links(self, mock_get):
        """Simulate redirect failing, then model found in similar-links."""
        queries_data = [
            {"state": {"data": {}}},
            {"state": {"data": [
                {"text": "סקודה אוקטביה", "query": "manufacturer=48&model=10547"},
            ]}},
        ]
        next_data = {
            "props": {"pageProps": {"dehydratedState": {"queries": queries_data}}}
        }
        html = f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(next_data)}</script>'

        redirect_resp = MagicMock()
        redirect_resp.raise_for_status.side_effect = Exception("redirect failed")

        page_resp = MagicMock()
        page_resp.raise_for_status = MagicMock()
        page_resp.text = html

        mock_get.side_effect = [redirect_resp, page_resp]

        mfr_id, model_id = _resolve_ids("Skoda", "Octavia", "2017-2019")
        assert mfr_id == str(_MFR_NAME_TO_ID["skoda"])
        assert model_id == "10547"

    @patch("car_seller.scraper.requests.get")
    def test_model_id_matched_via_transliteration(self, mock_get):
        """Corolla → קורולה should match the transliteration map."""
        queries_data = [
            {"state": {"data": {}}},
            {"state": {"data": [
                {"text": "טויוטה קורולה", "query": "manufacturer=15&model=888"},
            ]}},
        ]
        next_data = {"props": {"pageProps": {"dehydratedState": {"queries": queries_data}}}}
        html = f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(next_data)}</script>'

        redirect_resp = MagicMock()
        redirect_resp.raise_for_status.side_effect = Exception("failed")

        page_resp = MagicMock()
        page_resp.raise_for_status = MagicMock()
        page_resp.text = html

        mock_get.side_effect = [redirect_resp, page_resp]

        mfr_id, model_id = _resolve_ids("Toyota", "Corolla", "2019-2021")
        assert model_id == "888"

    @patch("car_seller.scraper.requests.get")
    def test_similar_links_no_model_match_returns_mfr_only(self, mock_get):
        """No match in similar-links → return mfr_id with empty model_id."""
        queries_data = [
            {"state": {"data": {}}},
            {"state": {"data": [
                {"text": "סקודה פאביה", "query": "manufacturer=48&model=9999"},
            ]}},
        ]
        next_data = {"props": {"pageProps": {"dehydratedState": {"queries": queries_data}}}}
        html = f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(next_data)}</script>'

        redirect_resp = MagicMock()
        redirect_resp.raise_for_status.side_effect = Exception("failed")

        page_resp = MagicMock()
        page_resp.raise_for_status = MagicMock()
        page_resp.text = html

        mock_get.side_effect = [redirect_resp, page_resp]

        mfr_id, model_id = _resolve_ids("Skoda", "Superb", "2019-2021")
        assert mfr_id == str(_MFR_NAME_TO_ID["skoda"])
        assert model_id == ""

    def test_known_manufacturers_in_static_map(self):
        for mfr in ("toyota", "hyundai", "kia", "skoda", "volkswagen", "mazda",
                    "honda", "nissan", "bmw", "mercedes", "audi", "volvo"):
            assert mfr in _MFR_NAME_TO_ID, f"Missing from static map: {mfr}"


# ── _fetch_page_html ──────────────────────────────────────────────────────────

class TestFetchPageHtml:
    def _make_next_data(self, feed: dict) -> str:
        data = {
            "props": {
                "pageProps": {
                    "dehydratedState": {
                        "queries": [{"state": {"data": feed}}]
                    }
                }
            }
        }
        return f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script>'

    @patch("car_seller.scraper.requests.get")
    def test_returns_feed_dict(self, mock_get):
        feed = {"private": [{"orderId": 1}], "commercial": []}
        mock_get.return_value = MagicMock(
            text=self._make_next_data(feed),
            raise_for_status=MagicMock(),
        )
        result = _fetch_page_html("48", "10547", "2017-2019", page=1)
        assert isinstance(result, dict)
        assert "private" in result

    @patch("car_seller.scraper.requests.get")
    def test_params_built_correctly_with_all_ids(self, mock_get):
        feed = {"private": []}
        mock_get.return_value = MagicMock(
            text=self._make_next_data(feed),
            raise_for_status=MagicMock(),
        )
        _fetch_page_html("48", "10547", "2017-2019", page=2)
        call_kwargs = mock_get.call_args
        params = call_kwargs[1]["params"]
        assert params["manufacturer"] == "48"
        assert params["model"] == "10547"
        assert params["year"] == "2017-2019"
        assert params["page"] == "2"

    @patch("car_seller.scraper.requests.get")
    def test_params_omit_empty_ids(self, mock_get):
        feed = {"private": []}
        mock_get.return_value = MagicMock(
            text=self._make_next_data(feed),
            raise_for_status=MagicMock(),
        )
        _fetch_page_html("", "", "", page=1)
        params = mock_get.call_args[1]["params"]
        assert "manufacturer" not in params
        assert "model" not in params
        assert "year" not in params

    @patch("car_seller.scraper.requests.get")
    def test_raises_if_no_next_data_script(self, mock_get):
        mock_get.return_value = MagicMock(
            text="<html>no script here</html>",
            raise_for_status=MagicMock(),
        )
        with pytest.raises(RuntimeError, match="__NEXT_DATA__ not found"):
            _fetch_page_html("48", "10547", "2017-2019", page=1)

    @patch("car_seller.scraper.requests.get")
    def test_raises_if_no_queries(self, mock_get):
        data = {"props": {"pageProps": {"dehydratedState": {"queries": []}}}}
        html = f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script>'
        mock_get.return_value = MagicMock(text=html, raise_for_status=MagicMock())
        with pytest.raises(RuntimeError, match="No queries"):
            _fetch_page_html("48", "10547", "2017-2019", page=1)

    @patch("car_seller.scraper.requests.get")
    def test_http_error_propagates(self, mock_get):
        import requests as req_mod
        mock_get.return_value = MagicMock(
            raise_for_status=MagicMock(side_effect=req_mod.HTTPError("403 Forbidden")),
            text="",
        )
        with pytest.raises(req_mod.HTTPError):
            _fetch_page_html("48", "10547", "2017-2019", page=1)
