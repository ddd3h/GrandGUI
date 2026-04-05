from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SerialConnectionBase(BaseModel):
    name: Optional[str] = None
    port_name: Optional[str] = None
    baudrate: int = 9600
    data_bits: int = 8
    stop_bits: float = 1.0
    parity: str = "N"
    timeout: float = 1.0
    encoding: str = "utf-8"
    source_type: str = "simulator"
    auto_reconnect: bool = False
    reconnect_interval: int = 5
    profile_id: Optional[int] = None


class SerialConnectionCreate(SerialConnectionBase):
    pass


class SerialConnectionUpdate(BaseModel):
    name: Optional[str] = None
    port_name: Optional[str] = None
    baudrate: Optional[int] = None
    data_bits: Optional[int] = None
    stop_bits: Optional[float] = None
    parity: Optional[str] = None
    timeout: Optional[float] = None
    encoding: Optional[str] = None
    source_type: Optional[str] = None
    auto_reconnect: Optional[bool] = None
    reconnect_interval: Optional[int] = None
    profile_id: Optional[int] = None


class SerialConnectionResponse(SerialConnectionBase):
    id: int
    is_active: bool
    last_connected_at: Optional[datetime] = None
    last_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectRequest(BaseModel):
    port_name: Optional[str] = None
    baudrate: int = 9600
    data_bits: int = 8
    stop_bits: float = 1.0
    parity: str = "N"
    timeout: float = 1.0
    encoding: str = "utf-8"
    source_type: str = "simulator"
    auto_reconnect: bool = False
    reconnect_interval: int = 5
    profile_id: Optional[int] = None
    simulator_interval: float = 1.0


class SerialStatusResponse(BaseModel):
    connected: bool
    source_type: Optional[str] = None
    port_name: Optional[str] = None
    baudrate: Optional[int] = None
    last_received_at: Optional[datetime] = None
    error_message: Optional[str] = None


class PortInfo(BaseModel):
    port: str
    description: Optional[str] = None
    hwid: Optional[str] = None
