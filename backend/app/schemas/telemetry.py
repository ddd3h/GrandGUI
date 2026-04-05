from pydantic import BaseModel, field_serializer
from typing import Optional, Any, List
from datetime import datetime


def _dt_to_utc_iso(dt: datetime | None) -> str | None:
    """Serialize naive datetime (stored as UTC in DB) with explicit Z suffix."""
    if dt is None:
        return None
    s = dt.isoformat()
    if not (s.endswith('Z') or '+' in s[10:]):
        s += 'Z'
    return s


class TelemetryRawResponse(BaseModel):
    id: int
    received_at: datetime
    source_type: str
    port_name: Optional[str] = None
    raw_line: str
    parse_ok: bool
    error_message: Optional[str] = None
    profile_id: Optional[int] = None

    model_config = {"from_attributes": True}

    @field_serializer('received_at')
    def serialize_received_at(self, dt: datetime) -> str | None:
        return _dt_to_utc_iso(dt)


class TelemetryPointResponse(BaseModel):
    id: int
    received_at: datetime
    raw_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    barometric_pressure: Optional[float] = None
    rssi: Optional[float] = None
    mode: Optional[str] = None
    battery: Optional[str] = None
    logging_status: Optional[str] = None
    wifi_status: Optional[str] = None
    gnss_status: Optional[str] = None
    payload_json: Optional[Any] = None

    model_config = {"from_attributes": True}

    @field_serializer('received_at')
    def serialize_received_at(self, dt: datetime) -> str | None:
        return _dt_to_utc_iso(dt)


class TelemetryHistoryQuery(BaseModel):
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    limit: int = 100
    offset: int = 0


class WebSocketMessage(BaseModel):
    type: str  # telemetry, status, error
    data: Any
    timestamp: datetime
