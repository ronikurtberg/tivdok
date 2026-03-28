"""Tests for /api/chat context-building logic — all branches of the system prompt."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest


# ── helpers ───────────────────────────────────────────────────────────────────

def _mock_openai_reply(text: str = "Great advice"):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=text))]
    )
    return mock_client


def _chat(api_client, monkeypatch, payload: dict, reply: str = "ok"):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    with patch("openai.OpenAI", return_value=_mock_openai_reply(reply)):
        return api_client.post("/api/chat", json=payload)


# ── no key / placeholder key ──────────────────────────────────────────────────

class TestChatAuth:
    def test_empty_key_returns_503(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "")
        resp = api_client.post("/api/chat", json={"message": "hello"})
        assert resp.status_code == 503

    def test_placeholder_key_returns_503(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "your_openai_api_key_here")
        resp = api_client.post("/api/chat", json={"message": "hello"})
        assert resp.status_code == 503

    def test_valid_key_returns_200(self, api_client, monkeypatch):
        resp = _chat(api_client, monkeypatch, {"message": "hello"})
        assert resp.status_code == 200
        assert resp.json()["reply"] == "ok"


# ── car context lines ─────────────────────────────────────────────────────────

class TestChatCarContext:
    """Each test verifies that a specific car field gets forwarded to OpenAI."""

    def _capture_prompt(self, api_client, monkeypatch, payload: dict):
        """Return the system prompt that would be sent to OpenAI."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        captured = {}

        def fake_create(**kwargs):
            captured["messages"] = kwargs["messages"]
            return MagicMock(choices=[MagicMock(message=MagicMock(content="reply"))])

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = fake_create
        with patch("openai.OpenAI", return_value=mock_client):
            api_client.post("/api/chat", json=payload)
        return captured.get("messages", [])

    def _sys(self, msgs):
        return next(m["content"] for m in msgs if m["role"] == "system")

    def test_year_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"year": 2019}
        })
        assert "2019" in self._sys(msgs)

    def test_manufacturer_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"manufacturer": "Hyundai"}
        })
        assert "Hyundai" in self._sys(msgs)

    def test_model_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"model": "Tucson"}
        })
        assert "Tucson" in self._sys(msgs)

    def test_sub_model_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"sub_model": "Elite"}
        })
        assert "Elite" in self._sys(msgs)

    def test_km_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"km": 75000}
        })
        assert "75,000" in self._sys(msgs)

    def test_hand_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"hand": 2}
        })
        assert "2" in self._sys(msgs)

    def test_gear_box_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"gear_box": "Automatic"}
        })
        assert "Automatic" in self._sys(msgs)

    def test_engine_type_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"engine_type": "Hybrid"}
        })
        assert "Hybrid" in self._sys(msgs)

    def test_engine_volume_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"engine_volume": 1600}
        })
        assert "1600" in self._sys(msgs)

    def test_horse_power_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"horse_power": 140}
        })
        assert "140" in self._sys(msgs)

    def test_doors_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"doors": 5}
        })
        assert "5" in self._sys(msgs)

    def test_body_type_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"body_type": "SUV"}
        })
        assert "SUV" in self._sys(msgs)

    def test_city_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"city": "Haifa"}
        })
        assert "Haifa" in self._sys(msgs)

    def test_test_date_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"test_date": "2026-10-10"}
        })
        assert "2026-10-10" in self._sys(msgs)

    def test_asking_price_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"asking_price": 98000}
        })
        assert "98,000" in self._sys(msgs)

    def test_description_in_prompt(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {
            "message": "hi", "car": {"description": "One careful owner"}
        })
        assert "One careful owner" in self._sys(msgs)

    def test_no_car_data_fallback(self, api_client, monkeypatch):
        msgs = self._capture_prompt(api_client, monkeypatch, {"message": "hi"})
        assert "No car data available" in self._sys(msgs)


# ── market context lines ──────────────────────────────────────────────────────

class TestChatMarketContext:
    def _capture_sys(self, api_client, monkeypatch, payload):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        captured = {}
        def fake_create(**kwargs):
            captured["messages"] = kwargs["messages"]
            return MagicMock(choices=[MagicMock(message=MagicMock(content="x"))])
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = fake_create
        with patch("openai.OpenAI", return_value=mock_client):
            api_client.post("/api/chat", json=payload)
        msgs = captured.get("messages", [])
        return next(m["content"] for m in msgs if m["role"] == "system")

    def test_listing_count_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "market": {"count": 42}
        })
        assert "42" in sys

    def test_price_range_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "market": {"min_price": 60000, "max_price": 120000}
        })
        assert "60,000" in sys
        assert "120,000" in sys

    def test_avg_price_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "market": {"avg_price": 91000}
        })
        assert "91,000" in sys

    def test_median_price_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "market": {"median_price": 89000}
        })
        assert "89,000" in sys

    def test_mileage_delta_above_shown(self, api_client, monkeypatch):
        """Car km > market avg_km → delta shown as 'above'."""
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "car": {"km": 110000},
            "market": {"avg_km": 90000}
        })
        assert "above" in sys
        assert "20,000" in sys

    def test_mileage_delta_below_shown(self, api_client, monkeypatch):
        """Car km < market avg_km → delta shown as 'below'."""
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "car": {"km": 50000},
            "market": {"avg_km": 90000}
        })
        assert "below" in sys
        assert "40,000" in sys

    def test_private_dealer_split_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "market": {"private_count": 8, "agent_count": 3}
        })
        assert "8" in sys
        assert "3" in sys

    def test_official_price_and_depreciation_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "official_price": 150000,
            "market": {"avg_price": 90000}
        })
        assert "150,000" in sys
        assert "depreciation" in sys.lower()

    def test_no_market_data_fallback(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {"message": "hi"})
        assert "No market data available" in sys

    def test_official_price_without_avg_no_depreciation(self, api_client, monkeypatch):
        """official_price present but no avg_price → no depreciation line."""
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "official_price": 150000,
        })
        assert "depreciation" not in sys.lower()


# ── history context lines ─────────────────────────────────────────────────────

class TestChatHistoryContext:
    def _capture_sys(self, api_client, monkeypatch, payload):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        captured = {}
        def fake_create(**kwargs):
            captured["messages"] = kwargs["messages"]
            return MagicMock(choices=[MagicMock(message=MagicMock(content="x"))])
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = fake_create
        with patch("openai.OpenAI", return_value=mock_client):
            api_client.post("/api/chat", json=payload)
        msgs = captured.get("messages", [])
        return next(m["content"] for m in msgs if m["role"] == "system")

    def test_history_count_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "history": [{"test_date": "2024-01", "km": 80000}, {"test_date": "2025-01", "km": 90000}]
        })
        assert "2" in sys

    def test_last_test_date_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "history": [{"test_date": "2025-10-01", "km": 88000}]
        })
        assert "2025-10-01" in sys

    def test_last_km_in_prompt(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "history": [{"test_date": "2025-10-01", "km": 88000}]
        })
        assert "88,000" in sys

    def test_no_history_fallback(self, api_client, monkeypatch):
        sys = self._capture_sys(api_client, monkeypatch, {"message": "hi"})
        assert "No history data available" in sys

    def test_history_last_entry_used(self, api_client, monkeypatch):
        """Multiple history entries — only last one is shown in prompt."""
        sys = self._capture_sys(api_client, monkeypatch, {
            "message": "hi",
            "history": [
                {"test_date": "2020-01-01", "km": 40000},
                {"test_date": "2025-10-01", "km": 90000},
            ]
        })
        assert "2025-10-01" in sys


# ── OpenAI error handling ─────────────────────────────────────────────────────

class TestChatErrors:
    def test_openai_exception_returns_502(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("rate limited")
        with patch("openai.OpenAI", return_value=mock_client):
            resp = api_client.post("/api/chat", json={"message": "hi"})
        assert resp.status_code == 502
        assert "rate limited" in resp.json()["detail"]

    def test_user_message_forwarded(self, api_client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        captured = {}
        def fake_create(**kwargs):
            captured["messages"] = kwargs["messages"]
            return MagicMock(choices=[MagicMock(message=MagicMock(content="reply"))])
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = fake_create
        with patch("openai.OpenAI", return_value=mock_client):
            api_client.post("/api/chat", json={"message": "What is the best price?"})
        user_msgs = [m for m in captured["messages"] if m["role"] == "user"]
        assert any("What is the best price?" in m["content"] for m in user_msgs)
