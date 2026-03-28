"""Tests for scraper utilities: classification, filtering, analysis, km enrichment."""
from __future__ import annotations

import json
import re
from unittest.mock import patch, MagicMock

import pytest

from car_seller.models import MyCar, Yad2Listing, MarketAnalysis
from car_seller.scraper import (
    _filter_outliers,
    _compute_analysis,
    _parse_listing,
    _nested_text,
    _nested_id,
    _extract_items,
    _enrich_km_batch,
    _fetch_km_for_token,
    _similarity_weight,
    _weighted_median,
)


# ── _nested_text / _nested_id ─────────────────────────────────────────────────

class TestNestedHelpers:
    def test_nested_text_from_dict(self):
        assert _nested_text({"id": 1, "text": "בנזין"}) == "בנזין"

    def test_nested_text_from_str(self):
        assert _nested_text("hello") == "hello"

    def test_nested_text_from_none(self):
        assert _nested_text(None) is None

    def test_nested_text_from_int(self):
        assert _nested_text(42) is None

    def test_nested_id_from_dict(self):
        assert _nested_id({"id": 7, "text": "יד שביעית"}) == 7

    def test_nested_id_from_non_dict(self):
        assert _nested_id("notadict") is None

    def test_nested_id_from_none(self):
        assert _nested_id(None) is None


# ── _filter_outliers ──────────────────────────────────────────────────────────

class TestFilterOutliers:
    def test_removes_extreme_high(self):
        prices = [80000, 85000, 90000, 95000, 100000, 2000000]
        lo, hi = _filter_outliers(prices)
        assert hi < 2000000

    def test_removes_extreme_low(self):
        prices = [100, 80000, 85000, 90000, 95000, 100000]
        lo, hi = _filter_outliers(prices)
        assert lo > 100

    def test_clean_data_unchanged_range(self):
        prices = [80000, 85000, 90000, 95000, 100000]
        lo, hi = _filter_outliers(prices)
        assert lo <= 80000
        assert hi >= 100000

    def test_too_few_prices_returns_full_range(self):
        prices = [50000, 60000, 70000]
        lo, hi = _filter_outliers(prices)
        assert lo == 0
        assert hi == float("inf")

    def test_single_price_handled(self):
        lo, hi = _filter_outliers([90000])
        assert lo == 0
        assert hi == float("inf")


# ── _weighted_median ──────────────────────────────────────────────────────────

class TestWeightedMedian:
    def test_equal_weights(self):
        values = [10.0, 20.0, 30.0, 40.0, 50.0]
        weights = [1.0] * 5
        result = _weighted_median(values, weights)
        assert result == 30.0

    def test_heavy_weight_on_low_value(self):
        values = [10.0, 50.0, 90.0]
        weights = [10.0, 1.0, 1.0]
        result = _weighted_median(values, weights)
        assert result == 10.0

    def test_heavy_weight_on_high_value(self):
        values = [10.0, 50.0, 90.0]
        weights = [1.0, 1.0, 10.0]
        result = _weighted_median(values, weights)
        assert result == 90.0


# ── _similarity_weight ────────────────────────────────────────────────────────

class TestSimilarityWeight:
    def test_exact_year_match_boosts(self, sample_car, sample_listing_factory):
        l = sample_listing_factory(year=sample_car.year)
        w = _similarity_weight(l, sample_car)
        assert w >= 2.0

    def test_year_off_by_one_partial_boost(self, sample_car, sample_listing_factory):
        l = sample_listing_factory(year=sample_car.year + 1)
        w = _similarity_weight(l, sample_car)
        assert 1.0 < w < 2.0

    def test_year_far_off_no_boost(self, sample_car, sample_listing_factory):
        l = sample_listing_factory(year=sample_car.year + 5)
        w_far = _similarity_weight(l, sample_car)
        l_exact = sample_listing_factory(year=sample_car.year)
        w_exact = _similarity_weight(l_exact, sample_car)
        assert w_far < w_exact

    def test_engine_volume_match_boosts(self, sample_car, sample_listing_factory):
        l_match = sample_listing_factory(year=sample_car.year)
        l_match = l_match.model_copy(update={"engine_volume": sample_car.engine_volume})
        l_no_match = sample_listing_factory(year=sample_car.year)
        l_no_match = l_no_match.model_copy(update={"engine_volume": 3000})
        assert _similarity_weight(l_match, sample_car) > _similarity_weight(l_no_match, sample_car)

    def test_same_hand_boosts(self, sample_car, sample_listing_factory):
        l_same = sample_listing_factory(hand=sample_car.hand, year=sample_car.year)
        l_diff = sample_listing_factory(hand=sample_car.hand + 2, year=sample_car.year)
        assert _similarity_weight(l_same, sample_car) > _similarity_weight(l_diff, sample_car)

    def test_no_data_returns_1(self):
        l = Yad2Listing(listing_id="x", url="https://yad2.co.il/item/x")
        car = MyCar(manufacturer="X", model="Y", year=2020, km=50000, hand=1)
        assert _similarity_weight(l, car) == 1.0


# ── _compute_analysis ─────────────────────────────────────────────────────────

class TestComputeAnalysis:
    def test_basic_stats(self, sample_listings, sample_car):
        analysis = _compute_analysis(sample_listings, car=sample_car)
        assert analysis.count > 0
        assert analysis.min_price is not None
        assert analysis.max_price is not None
        assert analysis.avg_price is not None
        assert analysis.median_price is not None

    def test_min_less_than_max(self, sample_listings, sample_car):
        analysis = _compute_analysis(sample_listings, car=sample_car)
        assert analysis.min_price < analysis.max_price

    def test_avg_km_populated(self, sample_listings, sample_car):
        analysis = _compute_analysis(sample_listings, car=sample_car)
        assert analysis.avg_km is not None
        assert analysis.avg_km > 0

    def test_private_and_agent_counts(self, sample_listings, sample_car):
        analysis = _compute_analysis(sample_listings, car=sample_car)
        assert analysis.private_count + analysis.agent_count == analysis.count

    def test_empty_listings(self):
        analysis = _compute_analysis([])
        assert analysis.count == 0
        assert analysis.avg_price is None

    def test_outlier_removal(self, sample_listing_factory):
        normal = [sample_listing_factory(f"n{i}", price=90000 + i * 1000, km=80000) for i in range(10)]
        outlier = sample_listing_factory("out", price=5000000, km=10000)
        analysis = _compute_analysis(normal + [outlier])
        assert analysis.max_price < 5000000

    def test_agent_count_matches_fixtures(self, sample_listings, sample_car):
        analysis = _compute_analysis(sample_listings, car=sample_car)
        expected_agents = sum(1 for l in sample_listings if l.is_agent)
        assert analysis.agent_count == expected_agents

    def test_listings_in_analysis_are_filtered(self, sample_listing_factory):
        listings = [sample_listing_factory(f"x{i}", price=90000, km=80000) for i in range(5)]
        analysis = _compute_analysis(listings)
        assert isinstance(analysis.listings, list)

    def test_no_km_data_avg_km_none(self, sample_listing_factory):
        listings = [
            sample_listing_factory(f"nk{i}", price=90000 + i * 1000, km=0)
            for i in range(5)
        ]
        for l in listings:
            object.__setattr__(l, "km", None)
        analysis = _compute_analysis(listings)
        assert analysis.avg_km is None


# ── _parse_listing ────────────────────────────────────────────────────────────

class TestParseListing:
    def _make_item(self, **overrides) -> dict:
        base = {
            "orderId": 12345,
            "token": "abctoken",
            "price": 95000,
            "hand": {"id": 2, "text": "יד שניה"},
            "vehicleDates": {"yearOfProduction": 2019},
            "engineType": {"id": 1101, "text": "בנזין"},
            "gearBox": {"id": 102, "text": "אוטומטי"},
            "color": {"id": 5, "text": "לבן"},
            "manufacturer": {"id": 48, "text": "קיה", "textEng": "Kia"},
            "model": {"id": 10711, "text": "פיקנטו", "textEng": "Picanto"},
            "subModel": {"id": 1, "text": "LX"},
            "customer": {},
            "metaData": {"coverImage": "https://img.yad2.co.il/test.jpg", "images": []},
            "address": {"area": {"text": "Tel Aviv"}},
        }
        base.update(overrides)
        return base

    def test_price_parsed_correctly(self):
        listing = _parse_listing(self._make_item(price=87500))
        assert listing.price == 87500

    def test_price_with_comma_string(self):
        listing = _parse_listing(self._make_item(price="87,500"))
        assert listing.price == 87500

    def test_token_used_in_url(self):
        listing = _parse_listing(self._make_item(token="mytoken"))
        assert "mytoken" in listing.url

    def test_is_agent_false_for_private(self):
        listing = _parse_listing(self._make_item(customer={}))
        assert listing.is_agent is False

    def test_is_agent_true_for_agency(self):
        listing = _parse_listing(self._make_item(customer={"agencyName": "Dealer Ltd"}))
        assert listing.is_agent is True

    def test_hand_extracted(self):
        listing = _parse_listing(self._make_item(hand={"id": 3, "text": "יד שלישית"}))
        assert listing.hand == 3

    def test_year_extracted(self):
        listing = _parse_listing(self._make_item(vehicleDates={"yearOfProduction": 2021}))
        assert listing.year == 2021

    def test_km_is_none_from_feed(self):
        listing = _parse_listing(self._make_item())
        assert listing.km is None

    def test_engine_type_text_extracted(self):
        listing = _parse_listing(self._make_item(engineType={"id": 1101, "text": "בנזין"}))
        assert listing.engine_type == "בנזין"

    def test_cover_image_extracted(self):
        listing = _parse_listing(self._make_item(
            metaData={"coverImage": "https://img.example.com/car.jpg", "images": []}
        ))
        assert listing.cover_image == "https://img.example.com/car.jpg"

    def test_missing_price_returns_none(self):
        listing = _parse_listing(self._make_item(price=None))
        assert listing.price is None

    def test_invalid_price_returns_none(self):
        listing = _parse_listing(self._make_item(price="N/A"))
        assert listing.price is None


# ── _extract_items ────────────────────────────────────────────────────────────

class TestExtractItems:
    def _feed(self, **buckets) -> dict:
        return buckets

    def test_extracts_private(self):
        feed = {"private": [{"orderId": 1}, {"orderId": 2}], "commercial": []}
        items = _extract_items(feed)
        assert len(items) == 2

    def test_extracts_commercial(self):
        feed = {"commercial": [{"orderId": 10}]}
        items = _extract_items(feed)
        assert len(items) == 1

    def test_skips_items_without_order_id(self):
        feed = {"private": [{"orderId": 1}, {"noId": True}]}
        items = _extract_items(feed)
        assert len(items) == 1

    def test_combines_all_buckets(self):
        feed = {
            "private": [{"orderId": 1}],
            "commercial": [{"orderId": 2}],
            "platinum": [{"orderId": 3}],
            "boost": [{"orderId": 4}],
            "solo": [{"orderId": 5}],
        }
        items = _extract_items(feed)
        assert len(items) == 5

    def test_empty_feed(self):
        assert _extract_items({}) == []


# ── _fetch_km_for_token ───────────────────────────────────────────────────────

class TestFetchKmForToken:
    def _mock_html(self, km_value: int) -> str:
        data = {
            "props": {
                "pageProps": {
                    "dehydratedState": {
                        "queries": [{
                            "state": {
                                "data": {"km": km_value, "price": 90000}
                            }
                        }]
                    }
                }
            }
        }
        payload = json.dumps(data)
        return f'<script id="__NEXT_DATA__" type="application/json">{payload}</script>'

    def test_empty_token_returns_none(self):
        result = _fetch_km_for_token("")
        assert result is None

    @patch("car_seller.scraper.requests.get")
    def test_returns_km_from_page(self, mock_get):
        mock_get.return_value = MagicMock(
            status_code=200,
            text=self._mock_html(145000),
        )
        result = _fetch_km_for_token("j7752tbh")
        assert result == 145000

    @patch("car_seller.scraper.requests.get")
    def test_404_returns_none(self, mock_get):
        mock_get.return_value = MagicMock(status_code=404)
        result = _fetch_km_for_token("missing")
        assert result is None

    @patch("car_seller.scraper.requests.get")
    def test_network_error_returns_none(self, mock_get):
        mock_get.side_effect = Exception("timeout")
        result = _fetch_km_for_token("anytoken")
        assert result is None

    @patch("car_seller.scraper.requests.get")
    def test_no_next_data_returns_none(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, text="<html>no script</html>")
        result = _fetch_km_for_token("tok")
        assert result is None

    @patch("car_seller.scraper.requests.get")
    def test_km_none_in_page_returns_none(self, mock_get):
        data = {"props": {"pageProps": {"dehydratedState": {"queries": [{"state": {"data": {"km": None}}}]}}}}
        html = f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script>'
        mock_get.return_value = MagicMock(status_code=200, text=html)
        result = _fetch_km_for_token("tok")
        assert result is None


# ── _enrich_km_batch ──────────────────────────────────────────────────────────

class TestEnrichKmBatch:
    @patch("car_seller.scraper._fetch_km_for_token")
    def test_enriches_listings_with_km(self, mock_fetch, sample_listing_factory):
        mock_fetch.return_value = 72000
        listings = [sample_listing_factory(f"t{i}", km=None) for i in range(3)]
        result = _enrich_km_batch(listings)
        enriched = [l for l in result if l.km is not None]
        assert len(enriched) == 3

    @patch("car_seller.scraper._fetch_km_for_token")
    def test_skips_listings_that_already_have_km(self, mock_fetch, sample_listing_factory):
        listings = [sample_listing_factory("already", km=50000)]
        _enrich_km_batch(listings)
        mock_fetch.assert_not_called()

    @patch("car_seller.scraper._fetch_km_for_token")
    def test_handles_failed_fetches_gracefully(self, mock_fetch, sample_listing_factory):
        mock_fetch.return_value = None
        listings = [sample_listing_factory(f"f{i}", km=None) for i in range(5)]
        result = _enrich_km_batch(listings)
        assert len(result) == 5
        assert all(l.km is None for l in result)

    @patch("car_seller.scraper._fetch_km_for_token")
    def test_respects_km_fetch_limit(self, mock_fetch, sample_listing_factory):
        from car_seller.scraper import KM_FETCH_LIMIT
        mock_fetch.return_value = 60000
        count = KM_FETCH_LIMIT + 5
        listings = [sample_listing_factory(f"lim{i}", km=None) for i in range(count)]
        _enrich_km_batch(listings)
        assert mock_fetch.call_count <= KM_FETCH_LIMIT

    def test_empty_list_returns_empty(self):
        result = _enrich_km_batch([])
        assert result == []
