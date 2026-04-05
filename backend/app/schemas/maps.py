from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OfflineMapPackageBase(BaseModel):
    name: str
    description: Optional[str] = None
    format_type: str = "pmtiles"
    min_zoom: Optional[int] = None
    max_zoom: Optional[int] = None
    min_lat: Optional[float] = None
    max_lat: Optional[float] = None
    min_lon: Optional[float] = None
    max_lon: Optional[float] = None


class OfflineMapPackageCreate(OfflineMapPackageBase):
    file_path: str
    file_size: Optional[int] = None


class OfflineMapPackageResponse(OfflineMapPackageBase):
    id: int
    file_path: str
    file_size: Optional[int] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
