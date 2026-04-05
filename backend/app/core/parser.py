"""
UART line parser. Converts raw line string into a dict based on profile definition.
"""
from typing import Optional, Dict, Any, List
import re


def parse_key_value_string(value: str) -> tuple[str, str]:
    """Parse 'Key:Value' format into (key, value) tuple."""
    if ":" in value:
        parts = value.split(":", 1)
        return parts[0].strip(), parts[1].strip()
    return "", value.strip()


def cast_field(raw_value: str, field_type: str) -> Any:
    """Cast string value to the specified type."""
    raw_value = raw_value.strip()
    if field_type == "float":
        try:
            return float(raw_value)
        except (ValueError, TypeError):
            return None
    elif field_type == "int":
        try:
            return int(raw_value)
        except (ValueError, TypeError):
            return None
    elif field_type == "key_value_string":
        _, val = parse_key_value_string(raw_value)
        return val
    else:
        return raw_value


def parse_line(raw_line: str, profile: dict) -> Dict[str, Any]:
    """
    Parse a raw UART line according to a profile definition.
    
    profile: {
        "delimiter": ",",
        "fields": [
            {"order_index": 0, "key": "latitude", "field_type": "float", ...},
            ...
        ]
    }
    
    Returns dict of {key: value} for each field.
    """
    delimiter = profile.get("delimiter", ",")
    fields = sorted(profile.get("fields", []), key=lambda f: f["order_index"])
    
    parts = raw_line.strip().split(delimiter)
    
    result: Dict[str, Any] = {}
    errors: List[str] = []
    
    for field in fields:
        idx = field["order_index"]
        key = field["key"]
        field_type = field.get("field_type", "string")
        
        if idx < len(parts):
            raw_val = parts[idx].strip()
            casted = cast_field(raw_val, field_type)
            result[key] = casted
        else:
            errors.append(f"Field '{key}' at index {idx} not found in line (only {len(parts)} parts)")
            result[key] = None
    
    if errors:
        result["_parse_errors"] = errors
    
    return result


def normalize_to_point(parsed: Dict[str, Any], fields: list) -> Dict[str, Any]:
    """
    Map parsed values to TelemetryPoint fixed fields and payload_json.
    Uses field metadata (is_latitude, is_longitude, etc.) to assign.
    """
    point = {
        "latitude": None,
        "longitude": None,
        "altitude": None,
        "barometric_pressure": None,
        "rssi": None,
        "mode": None,
        "battery": None,
        "logging_status": None,
        "wifi_status": None,
        "gnss_status": None,
        "payload_json": {},
    }
    
    fixed_key_map = {
        "barometric_pressure": "barometric_pressure",
        "rssi": "rssi",
        "mode": "mode",
        "battery": "battery",
        "logging_status": "logging_status",
        "wifi_status": "wifi_status",
        "gnss_status": "gnss_status",
    }
    
    for field in fields:
        key = field["key"]
        value = parsed.get(key)
        
        if field.get("is_latitude"):
            point["latitude"] = value
        elif field.get("is_longitude"):
            point["longitude"] = value
        elif field.get("is_altitude"):
            point["altitude"] = value
        elif key in fixed_key_map:
            point[fixed_key_map[key]] = value
        else:
            point["payload_json"][key] = value
    
    return point
