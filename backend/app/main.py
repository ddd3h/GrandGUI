import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db.base import engine
from .db import models
from .api import (
    serial_router, profiles_router, telemetry_router,
    dashboard_router, widgets_router, maps_router,
)
from .core.websocket_manager import ws_manager
from .core.receiver_service import receiver_service
from .db.base import SessionLocal
from .db.models import UartProfile, UartProfileField, Dashboard, Widget, WidgetLayout

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db():
    """Create all tables."""
    models.Base.metadata.create_all(bind=engine)


def seed_default_data():
    """Insert default profile and dashboard if not present."""
    db = SessionLocal()
    try:
        if db.query(UartProfile).count() == 0:
            profile = UartProfile(
                name="Default",
                description="Default UART profile matching the example format",
                delimiter=",",
                encoding="utf-8",
                is_default=True,
            )
            db.add(profile)
            db.flush()
            
            fields_def = [
                (0, "latitude",  "float", True,  False, False, True,  True,  False),
                (1, "longitude", "float", False, True,  False, True,  True,  False),
                (2, "altitude",  "float", False, False, True,  True,  True,  False),
                (3, "barometric_pressure", "float", False, False, False, False, True, False),
                (4, "rssi",      "float", False, False, False, False, True,  False),
                (5, "mode",      "key_value_string", False, False, False, False, False, True),
                (6, "battery",   "key_value_string", False, False, False, False, False, True),
                (7, "logging_status", "key_value_string", False, False, False, False, False, True),
                (8, "wifi_status",    "key_value_string", False, False, False, False, False, True),
                (9, "gnss_status",    "key_value_string", False, False, False, False, False, True),
            ]
            
            for (idx, key, ftype, is_lat, is_lon, is_alt, map_, graph, status) in fields_def:
                field = UartProfileField(
                    profile_id=profile.id,
                    order_index=idx,
                    key=key,
                    label=key.replace("_", " ").title(),
                    field_type=ftype,
                    is_latitude=is_lat,
                    is_longitude=is_lon,
                    is_altitude=is_alt,
                    use_for_map=map_,
                    use_for_graph=graph,
                    use_for_status=status,
                )
                db.add(field)
            
            db.commit()
            logger.info("Default UART profile created")
        
        if db.query(Dashboard).count() == 0:
            d = Dashboard(name="Main Dashboard", is_default=True)
            db.add(d)
            db.flush()
            
            default_widgets = [
                ("map", "Map", {"trackLength": 500, "followCurrent": True}),
                ("status", "Status", {"fields": ["mode", "battery", "logging_status", "wifi_status", "gnss_status"]}),
                ("graph", "Altitude", {"field": "altitude", "window": "5m"}),
                ("graph", "RSSI", {"field": "rssi", "window": "5m"}),
                ("graph", "Pressure", {"field": "barometric_pressure", "window": "5m"}),
            ]
            
            areas = ["center", "right", "center", "right", "right"]
            for i, ((wtype, title, cfg), area) in enumerate(zip(default_widgets, areas)):
                w = Widget(dashboard_id=d.id, widget_type=wtype, title=title, config=cfg)
                db.add(w)
                db.flush()
                layout = WidgetLayout(
                    widget_id=w.id,
                    device_profile="desktop",
                    area=area,
                    order_value=i,
                )
                db.add(layout)
            
            db.commit()
            logger.info("Default dashboard created")
    
    except Exception as e:
        logger.error(f"Seed error: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs("./data", exist_ok=True)
    os.makedirs("./data/maps", exist_ok=True)
    init_db()
    seed_default_data()
    logger.info("Application started")
    yield
    # Shutdown
    await receiver_service.stop()
    logger.info("Application stopped")


app = FastAPI(title="GrandGUI", version="0.1.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(serial_router)
app.include_router(profiles_router)
app.include_router(telemetry_router)
app.include_router(dashboard_router)
app.include_router(widgets_router)
app.include_router(maps_router)


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; server pushes data
            data = await websocket.receive_text()
            # Handle ping/pong or client messages if needed
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await ws_manager.disconnect(websocket)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve frontend static files if built
frontend_dist = os.path.join(os.path.dirname(__file__), "../../frontend/dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
