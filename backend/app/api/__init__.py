from .serial import router as serial_router
from .profiles import router as profiles_router
from .telemetry import router as telemetry_router
from .dashboard import router as dashboard_router, router_widgets as widgets_router
from .maps import router as maps_router

__all__ = [
    "serial_router",
    "profiles_router",
    "telemetry_router",
    "dashboard_router",
    "widgets_router",
    "maps_router",
]
