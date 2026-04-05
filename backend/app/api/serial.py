from fastapi import APIRouter, HTTPException
from typing import List
from ..core.uart_receiver import list_serial_ports
from ..core.receiver_service import receiver_service
from ..schemas.serial import ConnectRequest, SerialStatusResponse, PortInfo

router = APIRouter(prefix="/api/serial", tags=["serial"])


@router.get("/ports", response_model=List[PortInfo])
async def get_ports():
    """List available serial ports."""
    return list_serial_ports()


@router.post("/connect")
async def connect(req: ConnectRequest):
    """Start receiving data."""
    if receiver_service.is_running():
        await receiver_service.stop()
    
    config = req.model_dump()
    await receiver_service.start(config)
    return {"status": "started", "source_type": req.source_type}


@router.post("/disconnect")
async def disconnect():
    """Stop receiving data."""
    await receiver_service.stop()
    return {"status": "stopped"}


@router.get("/status", response_model=SerialStatusResponse)
async def get_status():
    """Get current connection status."""
    config = receiver_service.get_config()
    return SerialStatusResponse(
        connected=receiver_service.is_running(),
        source_type=config.get("source_type") if config else None,
        port_name=config.get("port_name") if config else None,
        baudrate=config.get("baudrate") if config else None,
        last_received_at=receiver_service.last_received_at,
        error_message=receiver_service.last_error,
    )
