"""Shared pytest fixtures for car-seller-assistant tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from car_seller.models import MyCar, MarketAnalysis, Yad2Listing
from car_seller.api import app


# ── Core model fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def sample_car() -> MyCar:
    return MyCar(
        manufacturer="Skoda",
        model="Octavia",
        year=2018,
        km=87000,
        hand=2,
        color="Silver",
        gear_box="Automatic",
        engine_type="Petrol",
        engine_volume=1400,
        horse_power=150,
        doors=5,
        body_type="Hatchback",
        city="Tel Aviv",
        test_date="2026-10-10",
        asking_price=95000,
    )


@pytest.fixture
def sample_listing_factory():
    """Return a callable that creates Yad2Listing instances with sensible defaults."""
    def _make(
        listing_id: str = "abc",
        price: int = 90000,
        km: int = 80000,
        year: int = 2018,
        is_agent: bool = False,
        hand: int = 2,
    ) -> Yad2Listing:
        return Yad2Listing(
            listing_id=listing_id,
            url=f"https://www.yad2.co.il/vehicles/item/{listing_id}",
            is_agent=is_agent,
            manufacturer_en="Skoda",
            model_en="Octavia",
            year=year,
            km=km,
            hand=hand,
            price=price,
            currency="ILS",
        )
    return _make


@pytest.fixture
def sample_listings(sample_listing_factory) -> list[Yad2Listing]:
    """15 varied listings for realistic analysis tests."""
    return [
        sample_listing_factory("l01", price=70000, km=60000),
        sample_listing_factory("l02", price=75000, km=70000),
        sample_listing_factory("l03", price=80000, km=75000),
        sample_listing_factory("l04", price=82000, km=80000),
        sample_listing_factory("l05", price=85000, km=85000),
        sample_listing_factory("l06", price=88000, km=88000),
        sample_listing_factory("l07", price=90000, km=90000),
        sample_listing_factory("l08", price=92000, km=92000),
        sample_listing_factory("l09", price=95000, km=95000),
        sample_listing_factory("l10", price=98000, km=98000),
        sample_listing_factory("l11", price=100000, km=100000),
        sample_listing_factory("l12", price=105000, km=105000, is_agent=True),
        sample_listing_factory("l13", price=110000, km=110000, is_agent=True),
        sample_listing_factory("l14", price=115000, km=120000, is_agent=True),
        sample_listing_factory("l15", price=120000, km=130000, is_agent=True),
    ]


@pytest.fixture
def sample_analysis(sample_listings, sample_car) -> MarketAnalysis:
    from car_seller.scraper import _compute_analysis
    return _compute_analysis(sample_listings, car=sample_car)


# ── FastAPI TestClient ─────────────────────────────────────────────────────────

@pytest.fixture
def api_client() -> TestClient:
    return TestClient(app)
