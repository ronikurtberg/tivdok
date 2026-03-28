"""Tests for selling plan generation (rule-based path)."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

from car_seller.models import MyCar, MarketAnalysis
from car_seller.selling_plan import _rule_based_plan, _fmt_ils, generate_selling_plan


# ── _fmt_ils ──────────────────────────────────────────────────────────────────

class TestFmtIls:
    def test_none_returns_na(self):
        assert _fmt_ils(None) == "N/A"

    def test_integer_formatted(self):
        assert _fmt_ils(90000) == "₪90,000"

    def test_float_truncated(self):
        assert _fmt_ils(90123.7) == "₪90,123"

    def test_zero(self):
        assert _fmt_ils(0) == "₪0"


# ── _rule_based_plan ──────────────────────────────────────────────────────────

class TestRuleBasedPlan:
    def test_plan_is_string(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, None)
        assert isinstance(plan, str)
        assert len(plan) > 100

    def test_plan_contains_car_name(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, None)
        assert "Skoda" in plan
        assert "Octavia" in plan
        assert str(sample_car.year) in plan

    def test_plan_contains_market_overview(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, None)
        assert "Market Overview" in plan or "market" in plan.lower()

    def test_plan_includes_official_price_section(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, official_price=150000)
        assert "150,000" in plan
        assert "Catalog" in plan or "catalog" in plan.lower()

    def test_plan_no_official_price(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, None)
        assert "N/A" not in plan or "catalog" not in plan.lower()

    def test_price_too_low_warns(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=87000, hand=2, asking_price=40000,
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "below" in plan.lower() or "underpricing" in plan.lower()

    def test_price_too_high_warns(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=87000, hand=2, asking_price=200000,
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "above" in plan.lower() or "slow" in plan.lower()

    def test_price_in_range_confirms(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=87000, hand=2, asking_price=90000,
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "within" in plan.lower() or "well" in plan.lower()

    def test_no_asking_price_no_comment(self, sample_car, sample_analysis):
        car = sample_car.model_copy(update={"asking_price": None})
        plan = _rule_based_plan(car, sample_analysis, None)
        assert isinstance(plan, str)

    def test_low_mileage_premium_noted(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=20000, hand=1,
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "Low mileage" in plan or "low" in plan.lower()

    def test_high_mileage_caution_noted(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=200000, hand=3,
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "High mileage" in plan or "high" in plan.lower()

    def test_first_hand_premium(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=50000, hand=1,
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "First-hand" in plan or "first" in plan.lower()

    def test_many_owners_caution(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=100000, hand=4,
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "owners" in plan.lower() or "3+" in plan

    def test_test_date_included(self, sample_analysis):
        car = MyCar(
            manufacturer="Skoda", model="Octavia", year=2018,
            km=87000, hand=2, test_date="2026-10-10",
        )
        plan = _rule_based_plan(car, sample_analysis, None)
        assert "2026-10" in plan or "tesт" in plan or "Test" in plan

    def test_high_competition_time_estimate(self, sample_car):
        from car_seller.models import Yad2Listing
        from car_seller.scraper import _compute_analysis
        listings = [
            Yad2Listing(
                listing_id=str(i),
                url=f"https://yad2.co.il/item/{i}",
                price=90000 + i * 100,
                km=80000,
            )
            for i in range(60)
        ]
        analysis = _compute_analysis(listings)
        plan = _rule_based_plan(sample_car, analysis, None)
        assert "weeks" in plan.lower()

    def test_plan_ends_with_disclaimer(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, None)
        assert "Car Seller Assistant" in plan or "estimate" in plan.lower()

    def test_plan_contains_negotiation_section(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, None)
        assert "Negotiation" in plan or "negotiat" in plan.lower()

    def test_plan_contains_where_to_sell(self, sample_car, sample_analysis):
        plan = _rule_based_plan(sample_car, sample_analysis, None)
        assert "Yad2" in plan


# ── generate_selling_plan ─────────────────────────────────────────────────────

class TestGenerateSellingPlan:
    def test_falls_back_to_rule_based_when_no_key(self, sample_car, sample_analysis, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        plan = generate_selling_plan(sample_car, sample_analysis, None)
        assert isinstance(plan, str)
        assert "Skoda" in plan

    def test_falls_back_to_rule_based_when_placeholder_key(
        self, sample_car, sample_analysis, monkeypatch
    ):
        monkeypatch.setenv("OPENAI_API_KEY", "your_openai_api_key_here")
        plan = generate_selling_plan(sample_car, sample_analysis, None)
        assert isinstance(plan, str)
        assert len(plan) > 50

    @patch("car_seller.selling_plan._openai_plan")
    def test_uses_openai_when_key_set(self, mock_openai, sample_car, sample_analysis, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-real-key")
        mock_openai.return_value = "# OpenAI Plan\nSell for ₪90,000"
        plan = generate_selling_plan(sample_car, sample_analysis, None)
        assert "OpenAI Plan" in plan
        mock_openai.assert_called_once()

    @patch("car_seller.selling_plan._openai_plan")
    def test_openai_failure_falls_back_to_rule_based(
        self, mock_openai, sample_car, sample_analysis, monkeypatch
    ):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-real-key")
        mock_openai.side_effect = Exception("API down")
        plan = generate_selling_plan(sample_car, sample_analysis, None)
        assert isinstance(plan, str)
        assert "Skoda" in plan
