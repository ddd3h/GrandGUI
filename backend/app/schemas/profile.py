from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class ColorRule(BaseModel):
    condition: str
    color: str
    label: Optional[str] = None


class UartProfileFieldBase(BaseModel):
    order_index: int
    key: str
    label: Optional[str] = None
    field_type: str = "string"
    unit: Optional[str] = None
    decimal_places: Optional[int] = None
    display_format: Optional[str] = None
    is_latitude: bool = False
    is_longitude: bool = False
    is_altitude: bool = False
    use_for_map: bool = False
    use_for_graph: bool = False
    use_for_status: bool = False
    is_hidden: bool = False
    color_rules: Optional[List[ColorRule]] = None


class UartProfileFieldCreate(UartProfileFieldBase):
    pass


class UartProfileFieldResponse(UartProfileFieldBase):
    id: int
    profile_id: int

    model_config = {"from_attributes": True}


class UartProfileBase(BaseModel):
    name: str
    description: Optional[str] = None
    delimiter: str = ","
    encoding: str = "utf-8"
    newline: str = "\n"
    is_default: bool = False


class UartProfileCreate(UartProfileBase):
    fields: List[UartProfileFieldCreate] = []


class UartProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    delimiter: Optional[str] = None
    encoding: Optional[str] = None
    newline: Optional[str] = None
    is_default: Optional[bool] = None
    fields: Optional[List[UartProfileFieldCreate]] = None


class UartProfileResponse(UartProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime
    fields: List[UartProfileFieldResponse] = []

    model_config = {"from_attributes": True}


class ValidateSampleRequest(BaseModel):
    sample_line: str


class ValidateSampleResponse(BaseModel):
    success: bool
    parsed: Optional[dict] = None
    error: Optional[str] = None
