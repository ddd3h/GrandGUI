"""Tests for UART line parser."""
import pytest
from app.core.parser import parse_line, normalize_to_point, cast_field, parse_key_value_string


SAMPLE_LINE = "35.681200, 139.767100, 50.0, 1013.25, -70.5, Mode:active, Bt:Full, Log:ON, WiFi:OK, GNSS:lock"

SAMPLE_PROFILE = {
    "delimiter": ",",
    "fields": [
        {"order_index": 0, "key": "latitude",  "field_type": "float",            "is_latitude": True,  "is_longitude": False, "is_altitude": False},
        {"order_index": 1, "key": "longitude", "field_type": "float",            "is_latitude": False, "is_longitude": True,  "is_altitude": False},
        {"order_index": 2, "key": "altitude",  "field_type": "float",            "is_latitude": False, "is_longitude": False, "is_altitude": True},
        {"order_index": 3, "key": "barometric_pressure", "field_type": "float",  "is_latitude": False, "is_longitude": False, "is_altitude": False},
        {"order_index": 4, "key": "rssi",      "field_type": "float",            "is_latitude": False, "is_longitude": False, "is_altitude": False},
        {"order_index": 5, "key": "mode",      "field_type": "key_value_string", "is_latitude": False, "is_longitude": False, "is_altitude": False},
        {"order_index": 6, "key": "battery",   "field_type": "key_value_string", "is_latitude": False, "is_longitude": False, "is_altitude": False},
        {"order_index": 7, "key": "logging_status", "field_type": "key_value_string", "is_latitude": False, "is_longitude": False, "is_altitude": False},
        {"order_index": 8, "key": "wifi_status",    "field_type": "key_value_string", "is_latitude": False, "is_longitude": False, "is_altitude": False},
        {"order_index": 9, "key": "gnss_status",    "field_type": "key_value_string", "is_latitude": False, "is_longitude": False, "is_altitude": False},
    ],
}


class TestCastField:
    def test_float_normal(self):
        assert cast_field("3.14", "float") == pytest.approx(3.14)

    def test_float_negative(self):
        assert cast_field("-70.5", "float") == pytest.approx(-70.5)

    def test_float_invalid(self):
        assert cast_field("abc", "float") is None

    def test_int_normal(self):
        assert cast_field("42", "int") == 42

    def test_int_invalid(self):
        assert cast_field("abc", "int") is None

    def test_string(self):
        assert cast_field("hello", "string") == "hello"

    def test_key_value_string(self):
        assert cast_field("Mode:active", "key_value_string") == "active"

    def test_key_value_no_colon(self):
        assert cast_field("active", "key_value_string") == "active"


class TestParseKeyValueString:
    def test_normal(self):
        k, v = parse_key_value_string("Mode:active")
        assert k == "Mode"
        assert v == "active"

    def test_no_colon(self):
        k, v = parse_key_value_string("active")
        assert k == ""
        assert v == "active"

    def test_value_with_colon(self):
        k, v = parse_key_value_string("Key:val:ue")
        assert k == "Key"
        assert v == "val:ue"


class TestParseLine:
    def test_sample_line_parsed(self):
        result = parse_line(SAMPLE_LINE, SAMPLE_PROFILE)
        assert result["latitude"] == pytest.approx(35.6812)
        assert result["longitude"] == pytest.approx(139.7671)
        assert result["altitude"] == pytest.approx(50.0)
        assert result["barometric_pressure"] == pytest.approx(1013.25)
        assert result["rssi"] == pytest.approx(-70.5)
        assert result["mode"] == "active"
        assert result["battery"] == "Full"
        assert result["logging_status"] == "ON"
        assert result["wifi_status"] == "OK"
        assert result["gnss_status"] == "lock"

    def test_missing_fields(self):
        short_line = "35.0, 139.0"
        result = parse_line(short_line, SAMPLE_PROFILE)
        assert result["latitude"] == pytest.approx(35.0)
        assert result["longitude"] == pytest.approx(139.0)
        assert result["altitude"] is None  # missing
        # _parse_errors is set when fields are missing
        assert "_parse_errors" in result
        assert any("altitude" in e for e in result["_parse_errors"])

    def test_empty_profile(self):
        result = parse_line(SAMPLE_LINE, {"delimiter": ",", "fields": []})
        assert result == {}


class TestNormalizeToPoint:
    def test_lat_lon_assigned(self):
        parsed = parse_line(SAMPLE_LINE, SAMPLE_PROFILE)
        point = normalize_to_point(parsed, SAMPLE_PROFILE["fields"])
        assert point["latitude"] == pytest.approx(35.6812)
        assert point["longitude"] == pytest.approx(139.7671)
        assert point["altitude"] == pytest.approx(50.0)

    def test_status_fields_assigned(self):
        parsed = parse_line(SAMPLE_LINE, SAMPLE_PROFILE)
        point = normalize_to_point(parsed, SAMPLE_PROFILE["fields"])
        assert point["mode"] == "active"
        assert point["battery"] == "Full"
        assert point["logging_status"] == "ON"
        assert point["wifi_status"] == "OK"
        assert point["gnss_status"] == "lock"

    def test_payload_json_empty_when_all_known(self):
        parsed = parse_line(SAMPLE_LINE, SAMPLE_PROFILE)
        point = normalize_to_point(parsed, SAMPLE_PROFILE["fields"])
        # All known fields mapped, payload_json should be empty or contain only unknown fields
        assert "latitude" not in point.get("payload_json", {})
