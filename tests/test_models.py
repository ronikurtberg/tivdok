"""Tests for Pydantic data models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from car_seller.models import MyCar, Yad2Listing, MarketAnalysis


class TestMyCar:
    def test_minimal_construction(self):
        car = MyCar(manufacturer="Toyota", model="Corolla", year=2020, km=50000, hand=1)
        assert car.manufacturer == "Toyota"
        assert car.model == "Corolla"
        assert car.year == 2020
        assert car.km == 50000
        assert car.hand == 1

    def test_full_construction(self, sample_car):
        assert sample_car.manufacturer == "Skoda"
        assert sample_car.asking_price == 95000
        assert sample_car.engine_volume == 1400
        assert sample_car.horse_power == 150

    def test_optional_fields_default_to_none(self):
        car = MyCar(manufacturer="Honda", model="Civic", year=2019, km=40000, hand=2)
        assert car.color is None
        assert car.asking_price is None
        assert car.description is None
        assert car.sub_model is None

    def test_model_dump_round_trip(self, sample_car):
        data = sample_car.model_dump()
        rebuilt = MyCar(**data)
        assert rebuilt.manufacturer == sample_car.manufacturer
        assert rebuilt.km == sample_car.km

    def test_year_stored_as_int(self):
        car = MyCar(manufacturer="BMW", model="3 Series", year=2021, km=30000, hand=1)
        assert isinstance(car.year, int)

    def test_km_stored_as_int(self):
        car = MyCar(manufacturer="Kia", model="Picanto", year=2018, km=145000, hand=2)
        assert isinstance(car.km, int)


class TestYad2Listing:
    def test_minimal_construction(self):
        listing = Yad2Listing(listing_id="abc123", url="https://yad2.co.il/item/abc123")
        assert listing.listing_id == "abc123"
        assert listing.km is None
        assert listing.price is None
        assert listing.is_agent is False

    def test_full_construction(self, sample_listing_factory):
        l = sample_listing_factory("xyz", price=80000, km=75000, is_agent=True)
        assert l.price == 80000
        assert l.km == 75000
        assert l.is_agent is True
        assert l.url == "https://www.yad2.co.il/vehicles/item/xyz"

    def test_model_copy_updates_km(self, sample_listing_factory):
        l = sample_listing_factory("t1", km=None)
        assert l.km is None
        updated = l.model_copy(update={"km": 60000})
        assert updated.km == 60000
        assert l.km is None  # original unchanged

    def test_model_copy_preserves_other_fields(self, sample_listing_factory):
        l = sample_listing_factory("t2", price=90000, km=None)
        updated = l.model_copy(update={"km": 50000})
        assert updated.price == 90000
        assert updated.listing_id == "t2"

    def test_currency_defaults_to_ILS(self, sample_listing_factory):
        l = sample_listing_factory()
        assert l.currency == "ILS"

    def test_is_agent_defaults_false(self):
        l = Yad2Listing(listing_id="z", url="https://yad2.co.il/item/z")
        assert l.is_agent is False


class TestMarketAnalysis:
    def test_construction_with_listings(self, sample_listings):
        analysis = MarketAnalysis(
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
        assert analysis.count == 15
        assert analysis.private_count == 11
        assert analysis.agent_count == 4

    def test_optional_prices_default_none(self):
        analysis = MarketAnalysis(
            listings=[],
            count=0,
            private_count=0,
            agent_count=0,
        )
        assert analysis.avg_price is None
        assert analysis.median_price is None
        assert analysis.min_price is None
        assert analysis.max_price is None
        assert analysis.avg_km is None

    def test_model_dump_serializable(self, sample_analysis):
        data = sample_analysis.model_dump()
        assert isinstance(data, dict)
        assert "listings" in data
        assert "count" in data
        assert isinstance(data["listings"], list)
