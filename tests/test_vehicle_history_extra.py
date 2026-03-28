"""Additional vehicle_history tests — edge cases not in test_vehicle_history.py."""
from __future__ import annotations

from unittest.mock import patch

import pytest

from car_seller.vehicle_history import get_vehicle_history


def _record(**overrides) -> dict:
    base = {
        "mispar_rechev": "1234567",
        "tozeret_nm": "סקודה",
        "degem_nm": "OCTAVIA",
        "kinuy_mishari": "OCTAVIA 1.4 TSI",
        "shnat_yitzur": "2018",
        "tzeva_rechev": "כסף",
        "sug_delek_nm": "בנזין",
        "ramat_gimur": "AMBITION",
        "misgeret": "TMBJG7NE0J0123456",
        "baalut": "פרטי",
        "moed_aliya_lakvish": "2018-03-01",
        "mivchan_acharon_dt": "2025-10-01",
        "tokef_dt": "2026-10-10",
        "zmig_kidmi": "205/55R16",
        "zmig_ahori": "205/55R16",
        "kvutzat_zihum": 7,
    }
    base.update(overrides)
    return base


class TestVehicleHistoryEdgeCases:

    @patch("car_seller.vehicle_history._ckan_query")
    def test_invalid_first_reg_date_no_crash(self, mock_query):
        """moed_aliya_lakvish is not a date string — ValueError must be caught."""
        mock_query.return_value = [_record(moed_aliya_lakvish="NOT-A-DATE")]
        result = get_vehicle_history("1234567")
        # Should still build test list from last_test_date alone
        assert result["test_count"] >= 1

    @patch("car_seller.vehicle_history._ckan_query")
    def test_missing_first_reg_falls_back_to_shnat_yitzur(self, mock_query):
        """No first_reg → estimated tests use shnat_yitzur year."""
        mock_query.return_value = [_record(moed_aliya_lakvish="", shnat_yitzur="2020")]
        result = get_vehicle_history("1234567")
        estimated = [t for t in result["tests"] if "Estimated" in (t.get("note") or "")]
        assert len(estimated) > 0

    @patch("car_seller.vehicle_history._ckan_query")
    def test_shnat_yitzur_none_no_crash(self, mock_query):
        """shnat_yitzur is None and no first_reg → TypeError caught gracefully."""
        mock_query.return_value = [_record(moed_aliya_lakvish="", shnat_yitzur=None)]
        result = get_vehicle_history("1234567")
        assert isinstance(result["tests"], list)

    @patch("car_seller.vehicle_history._ckan_query")
    def test_plate_with_spaces_normalised(self, mock_query):
        mock_query.return_value = []
        result = get_vehicle_history("123 4567")
        assert result["plate"] == "1234567"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_all_fields_confidence_high_when_found(self, mock_query):
        mock_query.return_value = [_record()]
        result = get_vehicle_history("1234567")
        for val in result["confidence"].values():
            assert val == "high"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_estimated_tests_capped_at_seven_years(self, mock_query):
        """Only up to 7 past estimated tests generated."""
        mock_query.return_value = [_record(
            moed_aliya_lakvish="2005-01-01",
            mivchan_acharon_dt="2025-10-01",
        )]
        result = get_vehicle_history("1234567")
        estimated = [t for t in result["tests"] if "Estimated" in (t.get("note") or "")]
        assert len(estimated) <= 7

    @patch("car_seller.vehicle_history._ckan_query")
    def test_last_test_entry_has_passed_result(self, mock_query):
        mock_query.return_value = [_record()]
        result = get_vehicle_history("1234567")
        most_recent = next(
            t for t in result["tests"]
            if "Most recent" in (t.get("note") or "")
        )
        assert most_recent["result"] == "passed"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_no_vin_not_in_summary(self, mock_query):
        mock_query.return_value = [_record(misgeret="")]
        result = get_vehicle_history("1234567")
        assert not any("VIN" in s for s in result["summary_points"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_no_first_reg_not_in_summary(self, mock_query):
        mock_query.return_value = [_record(moed_aliya_lakvish="")]
        result = get_vehicle_history("1234567")
        assert not any("First registered" in s for s in result["summary_points"])

    @patch("car_seller.vehicle_history._ckan_query")
    def test_tire_info_stored(self, mock_query):
        mock_query.return_value = [_record(zmig_kidmi="215/60R17", zmig_ahori="215/60R17")]
        result = get_vehicle_history("1234567")
        assert result["vehicle_info"]["tire_front"] == "215/60R17"
        assert result["vehicle_info"]["tire_rear"] == "215/60R17"

    @patch("car_seller.vehicle_history._ckan_query")
    def test_pollution_group_stored(self, mock_query):
        mock_query.return_value = [_record(kvutzat_zihum=5)]
        result = get_vehicle_history("1234567")
        assert result["vehicle_info"]["pollution_group"] == 5

    @patch("car_seller.vehicle_history._ckan_query")
    def test_return_has_disclaimer(self, mock_query):
        mock_query.return_value = [_record()]
        result = get_vehicle_history("1234567")
        assert "Accident history" in result["disclaimer"]
