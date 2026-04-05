from pydantic import BaseModel
from typing import Optional, Any, List
from datetime import datetime


class WidgetLayoutBase(BaseModel):
    device_profile: str = "desktop"
    area: str = "center"
    order_value: int = 0
    width_units: int = 1
    height_units: int = 1
    visibility: bool = True


class WidgetLayoutCreate(WidgetLayoutBase):
    pass


class WidgetLayoutUpdate(BaseModel):
    device_profile: Optional[str] = None
    area: Optional[str] = None
    order_value: Optional[int] = None
    width_units: Optional[int] = None
    height_units: Optional[int] = None
    visibility: Optional[bool] = None


class WidgetLayoutResponse(WidgetLayoutBase):
    id: int
    widget_id: int

    model_config = {"from_attributes": True}


class WidgetBase(BaseModel):
    widget_type: str
    title: Optional[str] = None
    config: Optional[Any] = None


class WidgetCreate(WidgetBase):
    dashboard_id: int
    layouts: List[WidgetLayoutCreate] = []


class WidgetUpdate(BaseModel):
    widget_type: Optional[str] = None
    title: Optional[str] = None
    config: Optional[Any] = None


class WidgetResponse(WidgetBase):
    id: int
    dashboard_id: int
    created_at: datetime
    layouts: List[WidgetLayoutResponse] = []

    model_config = {"from_attributes": True}


class DashboardBase(BaseModel):
    name: str
    is_default: bool = False


class DashboardCreate(DashboardBase):
    pass


class DashboardResponse(DashboardBase):
    id: int
    created_at: datetime
    updated_at: datetime
    widgets: List[WidgetResponse] = []

    model_config = {"from_attributes": True}


class LayoutPatchRequest(BaseModel):
    layouts: List[dict]  # [{widget_id, area, order_value, width_units, height_units, visibility, device_profile}]
