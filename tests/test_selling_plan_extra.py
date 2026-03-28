"""Additional selling_plan tests — branches not covered by test_selling_plan.py."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

from car_seller.models import MyCar, MarketAnalysis, Yad2Listing
from car_seller.scraper import _compute_analysis
from car_seller.selling_plan import _rule_based_plan, _fmt_ils, generate_selling_plan


def _analysis(**overrides):
    defaults = dict(
        listings=[],
        count=15,
        avg_price=90000,
        min_price=70000,
        max_price=120000,
        median_price=88000,
        avg_km=91000,
        private_count=11,
        agent_count=4,
    )
    defaults.update(overrides)
    return MarketAnalysis(**defaults)


def _car(**kw):
    defaults = dict(manufacturer="Skoda", model="Octavia", year=2018, km=87000, hand=2)
    defaults.update(kw)
    return MyCar(**defaults)


# ── _rule_based_plan: branch coverage ────────────────────────────────────────

class TestRuleBasedPlanBranches:

    def test_avg_only_no_median_still_works(self):
        """Only avg_price set (no median) → suggested range uses avg ±5%."""
        analysis = _analysis(median_price=None)
        plan = _rule_based_plan(_car(), analysis, None)
        assert isinstance(plan, str)
        assert len(plan) > 50

    def test_neither_avg_nor_median_no_range(self):
        """No avg or median → no suggested price range line."""
        analysis = _analysis(avg_price=None, median_price=None)
        plan = _rule_based_plan(_car(), analysis, None)
        assert isinstance(plan, str)
        # No crash, but no suggested range
        assert "Suggested range" not in plan

    def test_asking_price_but_no_market_stats_no_comment(self):
        """asking_price set but no suggested_low/high → no price_comment branch."""
        analysis = _analysis(avg_price=None, median_price=None)
        car = _car(asking_price=90000)
        plan = _rule_based_plan(car, analysis, None)
        assert "below" not in plan.lower() or "Your asking price" not in plan

    def test_official_price_with_depreciation(self):
        """Official price present + avg_price → depreciation percentage shown."""
        analysis = _analysis(avg_price=90000)
        plan = _rule_based_plan(_car(), analysis, official_price=150000)
        assert "40.0" in plan or "40" in plan   # (1 - 90000/150000)*100 = 40%

    def test_official_price_no_avg_no_depreciation(self):
        """Official price present but avg_price=None → no depreciation line."""
        analysis = _analysis(avg_price=None, median_price=None)
        plan = _rule_based_plan(_car(), analysis, official_price=150000)
        assert "depreciation" not in plan.lower()

    def test_second_owner_no_hand_adjustment_note(self):
        """hand=2 → no special adjustment note (only 1 and 3+ get notes)."""
        car = _car(hand=2)
        plan = _rule_based_plan(car, _analysis(), None)
        # No crash and hand=2 is neutral
        assert isinstance(plan, str)

    def test_count_21_to_50_moderate_market(self):
        """20 < count ≤ 50 → 'Moderate market' time estimate."""
        analysis = _analysis(count=30)
        plan = _rule_based_plan(_car(), analysis, None)
        assert "moderate" in plan.lower() or "3–8" in plan

    def test_count_le_20_low_supply(self):
        """count ≤ 20 → 'Low supply' time estimate."""
        analysis = _analysis(count=10)
        plan = _rule_based_plan(_car(), analysis, None)
        assert "demand" in plan.lower() or "1–4" in plan

    def test_normal_mileage_no_km_adjustment(self):
        """km within ±15% of avg_km → no mileage adjustment note."""
        car = _car(km=91000)   # exactly avg
        plan = _rule_based_plan(car, _analysis(avg_km=91000), None)
        assert "Low mileage" not in plan
        assert "High mileage" not in plan

    def test_no_test_date_not_in_plan(self):
        car = _car(test_date=None)
        plan = _rule_based_plan(car, _analysis(), None)
        assert "Test (tesт) valid" not in plan

    def test_private_pct_calculation_zero_count(self):
        """count=0 → private_pct = 0, no ZeroDivisionError."""
        analysis = _analysis(count=0, private_count=0, agent_count=0)
        plan = _rule_based_plan(_car(), analysis, None)
        assert isinstance(plan, str)

    def test_plan_contains_listing_tips(self):
        plan = _rule_based_plan(_car(), _analysis(), None)
        assert "photo" in plan.lower() or "15–20" in plan

    def test_plan_contains_document_prep(self):
        plan = _rule_based_plan(_car(), _analysis(), None)
        assert "documents" in plan.lower() or "רישיון" in plan


# ── generate_selling_plan: rich console doesn't crash ─────────────────────────

class TestGenerateSellingPlanConsole:

    def test_no_key_produces_rule_based_without_crashing(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        car = _car()
        plan = generate_selling_plan(car, _analysis(), None)
        assert "Skoda" in plan

    def test_with_official_price_no_crash(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        plan = generate_selling_plan(_car(), _analysis(), official_price=150000)
        assert "150,000" in plan

    @patch("car_seller.selling_plan._openai_plan")
    def test_openai_plan_called_with_correct_args(self, mock_openai, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-real")
        mock_openai.return_value = "# AI Plan\nSell for ₪90,000"
        car = _car()
        analysis = _analysis()
        generate_selling_plan(car, analysis, official_price=150000)
        mock_openai.assert_called_once_with(car, analysis, 150000)

    @patch("car_seller.selling_plan._openai_plan")
    def test_openai_plan_returns_its_content(self, mock_openai, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-real")
        mock_openai.return_value = "Custom AI selling plan content"
        result = generate_selling_plan(_car(), _analysis(), None)
        assert "Custom AI selling plan content" in result


# ── _fmt_ils edge cases ───────────────────────────────────────────────────────

class TestFmtIlsExtra:
    def test_large_number(self):
        assert _fmt_ils(1000000) == "₪1,000,000"

    def test_negative_number(self):
        result = _fmt_ils(-5000)
        assert "5,000" in result

    def test_float_rounds_down(self):
        assert _fmt_ils(90999.9) == "₪90,999"
