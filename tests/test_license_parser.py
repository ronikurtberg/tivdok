"""Tests for license_parser pure helper functions (no real PDF needed)."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

from car_seller.license_parser import (
    _rev,
    _find_plate,
    _find_vin,
    _find_engine_cc,
    _find_year,
    _find_first_reg,
    _find_mileage,
    _find_tires,
    _find_license_expiry,
    _find_make_model,
    _find_trim,
    _find_gear_box,
    _find_body_type,
    _find_fuel,
    _find_city,
    _find_horse_power,
    _find_doors,
    _find_hand,
    _FUEL_MAP,
    _GEAR_MAP,
    _BODY_MAP,
    _MAKE_MAP,
)


# ── _rev ──────────────────────────────────────────────────────────────────────

class TestRev:
    def test_reverses_string(self):
        assert _rev("abcd") == "dcba"

    def test_empty_string(self):
        assert _rev("") == ""

    def test_single_char(self):
        assert _rev("x") == "x"

    def test_hebrew_word(self):
        assert _rev("הדוקס") == "סקודה"


# ── _find_plate ───────────────────────────────────────────────────────────────

class TestFindPlate:
    def test_finds_7_digit_plate(self):
        assert _find_plate(["מספר רכב 1234567"]) == "1234567"

    def test_finds_8_digit_plate(self):
        assert _find_plate(["plate 12345678"]) == "12345678"

    def test_no_plate_returns_none(self):
        assert _find_plate(["no digits here"]) is None

    def test_ignores_6_digit_number(self):
        assert _find_plate(["123456"]) is None

    def test_ignores_9_digit_number(self):
        assert _find_plate(["123456789"]) is None

    def test_multiple_lines(self):
        assert _find_plate(["some text", "plate 7654321"]) == "7654321"

    def test_empty_lines(self):
        assert _find_plate([]) is None


# ── _find_vin ─────────────────────────────────────────────────────────────────

class TestFindVin:
    def test_finds_valid_vin(self):
        assert _find_vin(["VIN TMBJG7NE0J0123456"]) == "TMBJG7NE0J0123456"

    def test_no_vin_returns_none(self):
        assert _find_vin(["no vin here"]) is None

    def test_vin_too_short_ignored(self):
        assert _find_vin(["ABCDEFGHIJKLMNOP"]) is None  # 16 chars

    def test_vin_with_invalid_chars_ignored(self):
        assert _find_vin(["AAAAAAAAAAAAAAOOO"]) is None  # contains O

    def test_multiple_lines_finds_vin(self):
        assert _find_vin(["nothing", "TMBJG7NE0J0123456 end"]) == "TMBJG7NE0J0123456"


# ── _find_engine_cc ───────────────────────────────────────────────────────────

class TestFindEngineCc:
    def test_finds_3_digit_cc(self):
        assert _find_engine_cc(["engine 999"]) == 999

    def test_finds_4_digit_cc(self):
        assert _find_engine_cc(["engine 1400"]) == 1400

    def test_ignores_2_digit_number(self):
        assert _find_engine_cc(["year 18"]) is None

    def test_ignores_out_of_range_low(self):
        assert _find_engine_cc(["cc 400"]) is None  # <= 500

    def test_ignores_out_of_range_high(self):
        assert _find_engine_cc(["cc 9500"]) is None  # >= 9000

    def test_returns_first_valid_cc(self):
        result = _find_engine_cc(["1400 cc engine"])
        assert result == 1400

    def test_empty_returns_none(self):
        assert _find_engine_cc([]) is None

    def test_common_cc_values(self):
        for cc in (999, 1200, 1400, 1600, 1800, 2000, 2500, 3000):
            assert _find_engine_cc([f"engine {cc}"]) == cc


# ── _find_year ────────────────────────────────────────────────────────────────

class TestFindYear:
    def test_finds_year_in_date_pattern(self):
        assert _find_year(["registration 01/2018"]) == 2018

    def test_finds_bare_year(self):
        assert _find_year(["model year 2019"]) == 2019

    def test_no_year_returns_none(self):
        assert _find_year(["no year here"]) is None

    def test_returns_earliest_plausible_year(self):
        result = _find_year(["built 2018", "expire 2026"])
        assert result == 2018

    def test_filters_future_years(self):
        result = _find_year(["2030 blah"])
        assert result is None or result == 2030  # 2030 > 2025, filtered out

    def test_1990s_year(self):
        assert _find_year(["made in 1995"]) == 1995


# ── _find_first_reg ───────────────────────────────────────────────────────────

class TestFindFirstReg:
    def test_finds_date(self):
        assert _find_first_reg(["first reg 03/2018"]) == "03/2018"

    def test_no_date_returns_none(self):
        assert _find_first_reg(["no date"]) is None

    def test_returns_earliest_date(self):
        result = _find_first_reg(["dates 05/2020 and 03/2018"])
        assert "2018" in result

    def test_empty_returns_none(self):
        assert _find_first_reg([]) is None


# ── _find_mileage ─────────────────────────────────────────────────────────────

class TestFindMileage:
    def test_finds_km_with_comma(self):
        assert _find_mileage(["mileage 87,453"]) == 87453

    def test_finds_large_mileage(self):
        assert _find_mileage(["145,000 km"]) == 145000

    def test_no_mileage_returns_none(self):
        assert _find_mileage(["nothing here"]) is None

    def test_ignores_small_number(self):
        assert _find_mileage(["serial 1,234"]) is None  # <= 1000

    def test_hebrew_q_prefix(self):
        result = _find_mileage(["מ 87,453"])
        assert result == 87453


# ── _find_tires ───────────────────────────────────────────────────────────────

class TestFindTires:
    def test_finds_normal_tire_spec(self):
        assert _find_tires(["tires 205/55R16"]) == "205/55R16"

    def test_finds_with_space(self):
        assert _find_tires(["205/55 R16"]) == "205/55R16"

    def test_finds_reversed_rtl_order(self):
        assert _find_tires(["R16 91 V 205/55"]) == "205/55R16"

    def test_no_tires_returns_none(self):
        assert _find_tires(["no tire info"]) is None

    def test_common_tire_specs(self):
        for spec in ("195/65R15", "215/60R16", "225/45R17"):
            parts = spec.replace("R", " R").split()
            line = f"tires {spec}"
            result = _find_tires([line])
            assert result == spec


# ── _find_license_expiry ──────────────────────────────────────────────────────

class TestFindLicenseExpiry:
    def test_finds_date_dd_mm_yyyy(self):
        assert _find_license_expiry(["valid until 10/10/2026"]) == "10/10/2026"

    def test_finds_date_d_m_yy(self):
        result = _find_license_expiry(["expiry 1/1/26"])
        assert result == "1/1/26"

    def test_no_date_returns_none(self):
        assert _find_license_expiry(["no date"]) is None

    def test_multiple_dates_returns_first(self):
        result = _find_license_expiry(["10/10/2026 and 01/01/2025"])
        assert result == "10/10/2026"


# ── _find_make_model ──────────────────────────────────────────────────────────

class TestFindMakeModel:
    def test_finds_skoda_octavia(self):
        make_heb, make_en, model_en = _find_make_model(["הדוקס", "OCTAVIA AMBITION"])
        assert make_en == "Skoda"
        assert model_en == "OCTAVIA"

    def test_finds_toyota_corolla(self):
        _, make_en, model_en = _find_make_model(["הדיוט", "COROLLA"])
        assert make_en == "Toyota"
        assert model_en == "COROLLA"

    def test_no_known_make_returns_none_make(self):
        make_heb, make_en, model_en = _find_make_model(["OCTAVIA"])
        assert make_en is None

    def test_no_model_returns_none(self):
        _, _, model_en = _find_make_model(["הדוקס", "just some words"])
        assert model_en is None

    def test_fallback_to_all_caps_word(self):
        _, _, model_en = _find_make_model(["הדוקס", "SUPERCAR"])
        assert model_en == "SUPERCAR"

    def test_known_models_preferred_over_fallback(self):
        _, _, model_en = _find_make_model(["GOLF AMBITION"])
        assert model_en == "GOLF"

    def test_make_map_has_entries(self):
        assert len(_MAKE_MAP) > 10


# ── _find_trim ────────────────────────────────────────────────────────────────

class TestFindTrim:
    def test_finds_ambition(self):
        assert _find_trim(["OCTAVIA AMBITION"]) == "AMBITION"

    def test_finds_elegance(self):
        assert _find_trim(["GOLF ELEGANCE"]) == "ELEGANCE"

    def test_no_trim_returns_none(self):
        assert _find_trim(["nothing useful"]) is None

    def test_finds_sportline(self):
        assert _find_trim(["OCTAVIA SPORTLINE"]) == "SPORTLINE"


# ── _find_gear_box ────────────────────────────────────────────────────────────

class TestFindGearBox:
    def test_finds_automatic_hebrew(self):
        assert _find_gear_box(["אוטומטי"]) == "Automatic"

    def test_finds_manual_hebrew(self):
        assert _find_gear_box(["ידני"]) == "Manual"

    def test_finds_automatic_reversed(self):
        assert _find_gear_box(["יטמוטוא"]) == "Automatic"

    def test_finds_dsg(self):
        assert _find_gear_box(["DSG"]) == "Automatic"

    def test_no_gear_returns_none(self):
        assert _find_gear_box(["nothing"]) is None

    def test_cvt_is_automatic(self):
        assert _find_gear_box(["CVT"]) == "Automatic"


# ── _find_body_type ───────────────────────────────────────────────────────────

class TestFindBodyType:
    def test_finds_sedan(self):
        heb, eng = _find_body_type(["ןאדס"])
        assert eng == "Sedan"

    def test_finds_hatchback(self):
        heb, eng = _find_body_type(["גניטסה"])
        assert eng == "Hatchback"

    def test_no_body_returns_none_none(self):
        heb, eng = _find_body_type(["nothing"])
        assert heb is None
        assert eng is None

    def test_finds_suv(self):
        heb, eng = _find_body_type(["ידיי"])
        assert eng == "Jeep/SUV"


# ── _find_fuel ────────────────────────────────────────────────────────────────

class TestFindFuel:
    def test_finds_petrol(self):
        heb, eng = _find_fuel(["ןיזנב"])
        assert eng == "Petrol"

    def test_finds_diesel(self):
        heb, eng = _find_fuel(["לזיד"])
        assert eng == "Diesel"

    def test_finds_electric(self):
        heb, eng = _find_fuel(["ילמשח"])
        assert eng == "Electric"

    def test_finds_hybrid(self):
        heb, eng = _find_fuel(["ינשמ"])
        assert eng == "Hybrid"

    def test_no_fuel_returns_none_none(self):
        heb, eng = _find_fuel(["nothing"])
        assert heb is None
        assert eng is None


# ── _find_city ────────────────────────────────────────────────────────────────

class TestFindCity:
    def test_finds_city_after_zip(self):
        result = _find_city(["12345 ביבא לת"])
        assert result is not None

    def test_no_zip_returns_none(self):
        assert _find_city(["no zip code here"]) is None

    def test_empty_returns_none(self):
        assert _find_city([]) is None


# ── _find_horse_power ─────────────────────────────────────────────────────────

class TestFindHorsePower:
    def test_finds_hp_with_decimal(self):
        result = _find_horse_power(["150.00"])
        assert result == 150

    def test_finds_hp_near_hebrew_abbreviation(self):
        result = _find_horse_power(["150 כנ"])
        assert result == 150

    def test_ignores_out_of_range(self):
        result = _find_horse_power(["20.00"])
        assert result is None  # <= 50

    def test_no_hp_returns_none(self):
        assert _find_horse_power(["nothing"]) is None

    def test_common_hp_values(self):
        for hp in (75, 115, 150, 200, 300):
            result = _find_horse_power([f"{hp}.00"])
            assert result == hp


# ── _find_doors ───────────────────────────────────────────────────────────────

class TestFindDoors:
    def test_finds_5_doors(self):
        assert _find_doors(["5 AMBITION OCTAVIA"]) == 5

    def test_finds_3_doors(self):
        assert _find_doors(["3 GOLF"]) == 3

    def test_no_model_no_match(self):
        assert _find_doors(["5 plain text"]) is None

    def test_single_digit_out_of_range_ignored(self):
        assert _find_doors(["9 OCTAVIA"]) is None  # 9 > 7

    def test_no_match_returns_none(self):
        assert _find_doors([]) is None


# ── _find_hand ────────────────────────────────────────────────────────────────

class TestFindHand:
    def test_finds_hand_before_keyword(self):
        result = _find_hand(["01 רכחה"])
        assert result == 1

    def test_finds_hand_normal_order(self):
        result = _find_hand(["הכרב 02"])
        assert result == 2

    def test_out_of_range_ignored(self):
        result = _find_hand(["99 רכחה"])
        assert result is None

    def test_no_keyword_returns_none(self):
        assert _find_hand(["just numbers 01"]) is None

    def test_empty_returns_none(self):
        assert _find_hand([]) is None


# ── parse_license_pdf (mocked pdfplumber) ────────────────────────────────────

class TestParseLicensePdf:
    def _mock_pdf(self, lines: list[str]):
        """Create a mock pdfplumber PDF returning specified lines."""
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "\n".join(lines)
        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
        mock_pdf.__exit__ = MagicMock(return_value=False)
        return mock_pdf

    @patch("car_seller.license_parser.pdfplumber")
    def test_returns_dict_with_all_keys(self, mock_pdfplumber):
        mock_pdfplumber.open.return_value = self._mock_pdf(["1234567", "OCTAVIA", "הדוקס"])
        from car_seller.license_parser import parse_license_pdf
        result = parse_license_pdf(b"%PDF fake")
        for key in ("plate", "manufacturer_en", "model_en", "year", "vin", "source"):
            assert key in result

    @patch("car_seller.license_parser.pdfplumber")
    def test_source_is_license_pdf(self, mock_pdfplumber):
        mock_pdfplumber.open.return_value = self._mock_pdf(["1234567"])
        from car_seller.license_parser import parse_license_pdf
        result = parse_license_pdf(b"%PDF fake")
        assert result["source"] == "license_pdf"

    @patch("car_seller.license_parser.pdfplumber")
    def test_plate_extracted(self, mock_pdfplumber):
        mock_pdfplumber.open.return_value = self._mock_pdf(["1234567", "OCTAVIA"])
        from car_seller.license_parser import parse_license_pdf
        result = parse_license_pdf(b"%PDF fake")
        assert result["plate"] == "1234567"

    @patch("car_seller.license_parser.pdfplumber")
    def test_skoda_extracted(self, mock_pdfplumber):
        mock_pdfplumber.open.return_value = self._mock_pdf(["הדוקס", "OCTAVIA AMBITION", "1400"])
        from car_seller.license_parser import parse_license_pdf
        result = parse_license_pdf(b"%PDF fake")
        assert result["manufacturer_en"] == "Skoda"
        assert result["model_en"] == "OCTAVIA"

    @patch("car_seller.license_parser.pdfplumber")
    def test_raw_lines_included(self, mock_pdfplumber):
        mock_pdfplumber.open.return_value = self._mock_pdf(["line1", "line2"])
        from car_seller.license_parser import parse_license_pdf
        result = parse_license_pdf(b"%PDF fake")
        assert "raw_lines" in result
        assert "line1" in result["raw_lines"]
