"""Tests for scraper._compute_analysis — edge cases not covered by test_scraper.py."""
from __future__ import annotations

import pytest

from car_seller.models import MyCar, Yad2Listing
from car_seller.scraper import _compute_analysis


def _listing(listing_id="x", price=90000, km=80000, is_agent=False, sub_model=None):
    return Yad2Listing(
        listing_id=listing_id,
        url=f"https://www.yad2.co.il/vehicles/item/{listing_id}",
        price=price,
        km=km,
        is_agent=is_agent,
        sub_model=sub_model,
    )


def _car(**kw):
    defaults = dict(manufacturer="Skoda", model="Octavia", year=2018, km=87000, hand=2)
    defaults.update(kw)
    return MyCar(**defaults)


# ── empty / no-price listings ─────────────────────────────────────────────────

class TestComputeAnalysisEdgeCases:
    def test_empty_listings_returns_zeroes(self):
        result = _compute_analysis([])
        assert result.count == 0
        assert result.avg_price is None
        assert result.median_price is None
        assert result.min_price is None
        assert result.max_price is None
        assert result.avg_km is None
        assert result.private_count == 0
        assert result.agent_count == 0

    def test_listings_with_no_price_excluded_from_stats(self):
        listings = [
            _listing("a", price=None, km=50000),
            _listing("b", price=0, km=60000),
        ]
        result = _compute_analysis(listings)
        assert result.avg_price is None
        assert result.median_price is None

    def test_single_priced_listing(self):
        result = _compute_analysis([_listing("a", price=85000, km=70000)])
        assert result.avg_price == 85000
        assert result.median_price == 85000
        assert result.min_price == 85000
        assert result.max_price == 85000

    def test_three_listings_below_outlier_threshold(self):
        """< 4 listings → no outlier removal."""
        listings = [
            _listing("a", price=50000),
            _listing("b", price=90000),
            _listing("c", price=200000),  # would be outlier with ≥4 but not here
        ]
        result = _compute_analysis(listings)
        assert result.count == 3

    def test_agent_private_split(self):
        listings = [
            _listing("p1", is_agent=False),
            _listing("p2", is_agent=False),
            _listing("d1", is_agent=True),
        ]
        result = _compute_analysis(listings)
        assert result.private_count == 2
        assert result.agent_count == 1

    def test_km_average_excludes_none_km(self):
        listings = [
            _listing("a", km=60000),
            _listing("b", km=80000),
            _listing("c", km=None),
        ]
        result = _compute_analysis(listings)
        assert result.avg_km == 70000

    def test_no_km_listings_avg_km_none(self):
        listings = [_listing("a", km=None), _listing("b", km=None)]
        result = _compute_analysis(listings)
        assert result.avg_km is None

    def test_outlier_removal_with_four_plus_listings(self):
        """With ≥4 listings, extreme outlier should be removed."""
        listings = [
            _listing("a", price=85000),
            _listing("b", price=90000),
            _listing("c", price=95000),
            _listing("d", price=100000),
            _listing("e", price=5000000),  # extreme outlier
        ]
        result = _compute_analysis(listings)
        assert result.max_price < 5000000

    def test_without_car_no_weighting(self):
        """car=None → plain mean/median, no weighted stats."""
        listings = [
            _listing("a", price=80000, km=70000),
            _listing("b", price=100000, km=90000),
        ]
        result = _compute_analysis(listings, car=None)
        assert result.avg_price == 90000
        assert result.median_price == 90000

    def test_with_car_weighted_stats_differ(self):
        """With car context, weighted avg may differ from plain mean."""
        listings = [
            _listing("a", price=80000, km=87000, is_agent=False),   # close to car
            _listing("b", price=80000, km=87000, is_agent=False),
            _listing("c", price=200000, km=200000, is_agent=True),  # dissimilar
        ]
        car = _car(km=87000, hand=2)
        result = _compute_analysis(listings, car=car)
        # Weighted result should be pulled toward the similar listings
        assert result.avg_price < 150000

    def test_trim_match_in_weighted_stats(self):
        """Listings with matching sub_model get higher weight."""
        listings = [
            _listing("a", price=90000, km=80000, sub_model="AMBITION"),
            _listing("b", price=90000, km=80000, sub_model="AMBITION"),
            _listing("c", price=90000, km=80000, sub_model="STYLE"),
        ]
        car = _car(km=80000, sub_model="AMBITION")
        result = _compute_analysis(listings, car=car)
        assert result.avg_price is not None  # no crash with trim matching

    def test_count_equals_clean_listings_length(self):
        listings = [_listing(str(i), price=90000 + i * 1000, km=80000) for i in range(10)]
        result = _compute_analysis(listings)
        assert result.count == len(result.listings)


# ── /api/analyze forwarding ───────────────────────────────────────────────────

class TestAnalyzeParams:
    """Verify that extra AnalyzeRequest fields are correctly forwarded."""

    def _mock_market(self, sample_listings):
        from car_seller.models import MarketAnalysis
        return MarketAnalysis(
            listings=sample_listings,
            count=len(sample_listings),
            avg_price=90000,
            min_price=70000,
            max_price=110000,
            median_price=90000,
            avg_km=85000,
            private_count=11,
            agent_count=4,
        )

    def test_body_type_passed_through(self, api_client, sample_listings):
        """body_type is in AnalyzeRequest and should appear in the car response."""
        from unittest.mock import patch
        with patch("car_seller.api.scrape_market") as mock_scrape, \
             patch("car_seller.api.lookup_official_price", return_value=None), \
             patch("car_seller.api.generate_selling_plan", return_value="plan"):
            mock_scrape.return_value = self._mock_market(sample_listings)
            resp = api_client.post("/api/analyze", json={
                "manufacturer": "Skoda", "model": "Octavia", "year": 2018,
                "km": 80000, "hand": 2, "body_type": "Hatchback",
            })
        assert resp.status_code == 200
        assert resp.json()["car"]["body_type"] == "Hatchback"

    def test_exclude_agents_forwarded(self, api_client, sample_listings):
        from unittest.mock import patch
        with patch("car_seller.api.scrape_market") as mock_scrape, \
             patch("car_seller.api.lookup_official_price", return_value=None), \
             patch("car_seller.api.generate_selling_plan", return_value="plan"):
            mock_scrape.return_value = self._mock_market(sample_listings)
            api_client.post("/api/analyze", json={
                "manufacturer": "Skoda", "model": "Octavia", "year": 2018,
                "km": 80000, "hand": 2, "exclude_agents": True,
            })
            _, kwargs = mock_scrape.call_args
            assert kwargs.get("exclude_agents") is True

    def test_max_items_forwarded(self, api_client, sample_listings):
        from unittest.mock import patch
        with patch("car_seller.api.scrape_market") as mock_scrape, \
             patch("car_seller.api.lookup_official_price", return_value=None), \
             patch("car_seller.api.generate_selling_plan", return_value="plan"):
            mock_scrape.return_value = self._mock_market(sample_listings)
            api_client.post("/api/analyze", json={
                "manufacturer": "Skoda", "model": "Octavia", "year": 2018,
                "km": 80000, "hand": 2, "max_items": 25,
            })
            _, kwargs = mock_scrape.call_args
            assert kwargs.get("max_items") == 25

    def test_asking_price_included_in_car_response(self, api_client, sample_listings):
        from unittest.mock import patch
        with patch("car_seller.api.scrape_market") as mock_scrape, \
             patch("car_seller.api.lookup_official_price", return_value=None), \
             patch("car_seller.api.generate_selling_plan", return_value="plan"):
            mock_scrape.return_value = self._mock_market(sample_listings)
            resp = api_client.post("/api/analyze", json={
                "manufacturer": "Skoda", "model": "Octavia", "year": 2018,
                "km": 80000, "hand": 2, "asking_price": 95000,
            })
        assert resp.json()["car"]["asking_price"] == 95000

    def test_optional_fields_default_excluded_from_car(self, api_client, sample_listings):
        """max_items and exclude_agents must NOT appear in the car dict."""
        from unittest.mock import patch
        with patch("car_seller.api.scrape_market") as mock_scrape, \
             patch("car_seller.api.lookup_official_price", return_value=None), \
             patch("car_seller.api.generate_selling_plan", return_value="plan"):
            mock_scrape.return_value = self._mock_market(sample_listings)
            resp = api_client.post("/api/analyze", json={
                "manufacturer": "Skoda", "model": "Octavia", "year": 2018,
                "km": 80000, "hand": 2,
            })
        car = resp.json()["car"]
        assert "max_items" not in car
        assert "exclude_agents" not in car
