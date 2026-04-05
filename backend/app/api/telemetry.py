from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import csv
import json
import io

from ..db.base import get_db
from ..db.models import TelemetryPoint, TelemetryRaw
from ..schemas.telemetry import TelemetryPointResponse, TelemetryRawResponse

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.get("/latest", response_model=Optional[TelemetryPointResponse])
def get_latest(db: Session = Depends(get_db)):
    point = db.query(TelemetryPoint).order_by(desc(TelemetryPoint.received_at)).first()
    return point


@router.get("/history", response_model=List[TelemetryPointResponse])
def get_history(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    limit: int = Query(100, le=10000),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    q = db.query(TelemetryPoint).order_by(desc(TelemetryPoint.received_at))
    if start:
        q = q.filter(TelemetryPoint.received_at >= start)
    if end:
        q = q.filter(TelemetryPoint.received_at <= end)
    return q.offset(offset).limit(limit).all()


@router.get("/export")
def export_history(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: Session = Depends(get_db),
):
    q = db.query(TelemetryPoint).order_by(TelemetryPoint.received_at)
    if start:
        q = q.filter(TelemetryPoint.received_at >= start)
    if end:
        q = q.filter(TelemetryPoint.received_at <= end)
    
    points = q.all()
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "received_at", "latitude", "longitude", "altitude",
            "barometric_pressure", "rssi", "mode", "battery",
            "logging_status", "wifi_status", "gnss_status", "payload_json"
        ])
        for p in points:
            writer.writerow([
                p.id, p.received_at, p.latitude, p.longitude, p.altitude,
                p.barometric_pressure, p.rssi, p.mode, p.battery,
                p.logging_status, p.wifi_status, p.gnss_status,
                json.dumps(p.payload_json) if p.payload_json else ""
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=telemetry.csv"},
        )
    else:
        data = [
            {
                "id": p.id,
                "received_at": p.received_at.isoformat() if p.received_at else None,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "altitude": p.altitude,
                "barometric_pressure": p.barometric_pressure,
                "rssi": p.rssi,
                "mode": p.mode,
                "battery": p.battery,
                "logging_status": p.logging_status,
                "wifi_status": p.wifi_status,
                "gnss_status": p.gnss_status,
                "payload_json": p.payload_json,
            }
            for p in points
        ]
        return Response(
            content=json.dumps(data, default=str),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=telemetry.json"},
        )
