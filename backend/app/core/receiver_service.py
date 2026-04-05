"""
Service that orchestrates UART reception, parsing, saving, and WebSocket broadcasting.
This is the main runtime service.
"""
import asyncio
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from .uart_receiver import UartReceiver
from .parser import parse_line, normalize_to_point
from .websocket_manager import ws_manager
from ..db.base import SessionLocal
from ..db.models import TelemetryRaw, TelemetryPoint, UartProfile

logger = logging.getLogger(__name__)


def _get_active_profile(db: Session) -> Optional[Dict]:
    """Get the default/active UART profile as a dict."""
    profile = db.query(UartProfile).filter(UartProfile.is_default == True).first()
    if not profile:
        profile = db.query(UartProfile).first()
    if not profile:
        return None
    return {
        "id": profile.id,
        "delimiter": profile.delimiter,
        "encoding": profile.encoding,
        "fields": [
            {
                "order_index": f.order_index,
                "key": f.key,
                "label": f.label,
                "field_type": f.field_type,
                "unit": f.unit,
                "decimal_places": f.decimal_places,
                "is_latitude": f.is_latitude,
                "is_longitude": f.is_longitude,
                "is_altitude": f.is_altitude,
                "use_for_map": f.use_for_map,
                "use_for_graph": f.use_for_graph,
                "use_for_status": f.use_for_status,
                "is_hidden": f.is_hidden,
                "color_rules": f.color_rules,
            }
            for f in profile.fields
        ],
    }


class ReceiverService:
    def __init__(self):
        self._receiver: Optional[UartReceiver] = None
        self._config: Optional[Dict] = None
        self._running = False
        self.last_received_at: Optional[datetime] = None
        self.last_error: Optional[str] = None

    def is_running(self) -> bool:
        return self._running and self._receiver is not None and self._receiver.is_running()

    def get_config(self) -> Optional[Dict]:
        return self._config

    async def start(self, config: Dict):
        if self._running:
            await self.stop()
        
        self._config = config
        self._receiver = UartReceiver(
            source_type=config.get("source_type", "simulator"),
            port_name=config.get("port_name"),
            baudrate=config.get("baudrate", 9600),
            data_bits=config.get("data_bits", 8),
            stop_bits=config.get("stop_bits", 1.0),
            parity=config.get("parity", "N"),
            timeout=config.get("timeout", 1.0),
            encoding=config.get("encoding", "utf-8"),
            auto_reconnect=config.get("auto_reconnect", False),
            reconnect_interval=config.get("reconnect_interval", 5),
            simulator_interval=config.get("simulator_interval", 1.0),
        )
        
        self._running = True
        await self._receiver.start(self._on_line)
        logger.info(f"ReceiverService started: {config.get('source_type')}")

    async def stop(self):
        if self._receiver:
            await self._receiver.stop()
        self._running = False
        self._receiver = None
        logger.info("ReceiverService stopped")

    async def _on_line(self, line: str, source_type: str, port_name: Optional[str]):
        """Handle received line: parse, save, broadcast."""
        self.last_received_at = datetime.utcnow()
        
        db = SessionLocal()
        try:
            profile_dict = _get_active_profile(db)
            
            parse_ok = True
            error_message = None
            parsed = {}
            
            if profile_dict:
                try:
                    parsed = parse_line(line, profile_dict)
                    if "_parse_errors" in parsed:
                        error_message = "; ".join(parsed.pop("_parse_errors"))
                        parse_ok = len(parsed) > 0  # partial parse is still ok
                except Exception as e:
                    parse_ok = False
                    error_message = str(e)
                    self.last_error = error_message
            else:
                parse_ok = False
                error_message = "No profile configured"
            
            # Save raw
            raw = TelemetryRaw(
                received_at=self.last_received_at,
                source_type=source_type,
                port_name=port_name,
                raw_line=line,
                parse_ok=parse_ok,
                error_message=error_message,
                profile_id=profile_dict["id"] if profile_dict else None,
            )
            db.add(raw)
            db.flush()
            
            # Save normalized point if parsed
            point_id = None
            if parse_ok and profile_dict and parsed:
                point_data = normalize_to_point(parsed, profile_dict.get("fields", []))
                point = TelemetryPoint(
                    received_at=self.last_received_at,
                    raw_id=raw.id,
                    **{k: v for k, v in point_data.items() if k != "payload_json"},
                    payload_json=point_data.get("payload_json"),
                )
                db.add(point)
                db.flush()
                point_id = point.id
                
                # Broadcast
                broadcast_data = {
                    "id": point.id,
                    "received_at": self.last_received_at.isoformat() + "Z",
                    "latitude": point.latitude,
                    "longitude": point.longitude,
                    "altitude": point.altitude,
                    "barometric_pressure": point.barometric_pressure,
                    "rssi": point.rssi,
                    "mode": point.mode,
                    "battery": point.battery,
                    "logging_status": point.logging_status,
                    "wifi_status": point.wifi_status,
                    "gnss_status": point.gnss_status,
                    "payload_json": point.payload_json,
                    "raw_line": line,
                }
                await ws_manager.broadcast_telemetry(broadcast_data)
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error processing line: {e}")
            self.last_error = str(e)
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()


# Global singleton
receiver_service = ReceiverService()
