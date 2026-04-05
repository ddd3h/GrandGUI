from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class UartProfile(Base):
    __tablename__ = "uart_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    delimiter = Column(String(10), nullable=False, default=",")
    encoding = Column(String(20), nullable=False, default="utf-8")
    newline = Column(String(10), nullable=False, default="\n")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    fields = relationship("UartProfileField", back_populates="profile", cascade="all, delete-orphan", order_by="UartProfileField.order_index")
    connections = relationship("SerialConnection", back_populates="profile")
    raw_data = relationship("TelemetryRaw", back_populates="profile")


class UartProfileField(Base):
    __tablename__ = "uart_profile_fields"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("uart_profiles.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    key = Column(String(50), nullable=False)
    label = Column(String(100), nullable=True)
    field_type = Column(String(20), nullable=False, default="string")  # float, int, string, key_value_string
    unit = Column(String(20), nullable=True)
    decimal_places = Column(Integer, nullable=True)
    display_format = Column(String(50), nullable=True)
    is_latitude = Column(Boolean, default=False)
    is_longitude = Column(Boolean, default=False)
    is_altitude = Column(Boolean, default=False)
    use_for_map = Column(Boolean, default=False)
    use_for_graph = Column(Boolean, default=False)
    use_for_status = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    color_rules = Column(JSON, nullable=True)  # [{condition, color, label}]

    profile = relationship("UartProfile", back_populates="fields")

    __table_args__ = (
        UniqueConstraint("profile_id", "order_index", name="uq_profile_field_order"),
    )


class SerialConnection(Base):
    __tablename__ = "serial_connections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    port_name = Column(String(50), nullable=True)
    baudrate = Column(Integer, nullable=False, default=9600)
    data_bits = Column(Integer, nullable=False, default=8)
    stop_bits = Column(Float, nullable=False, default=1.0)
    parity = Column(String(5), nullable=False, default="N")
    timeout = Column(Float, nullable=False, default=1.0)
    encoding = Column(String(20), nullable=False, default="utf-8")
    source_type = Column(String(20), nullable=False, default="simulator")  # physical, virtual, simulator
    auto_reconnect = Column(Boolean, default=False)
    reconnect_interval = Column(Integer, default=5)
    profile_id = Column(Integer, ForeignKey("uart_profiles.id"), nullable=True)
    is_active = Column(Boolean, default=False)
    last_connected_at = Column(DateTime, nullable=True)
    last_status = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    profile = relationship("UartProfile", back_populates="connections")


class TelemetryRaw(Base):
    __tablename__ = "telemetry_raw"

    id = Column(Integer, primary_key=True, index=True)
    received_at = Column(DateTime, server_default=func.now(), index=True)
    source_type = Column(String(20), nullable=False)
    port_name = Column(String(50), nullable=True)
    raw_line = Column(Text, nullable=False)
    parse_ok = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    profile_id = Column(Integer, ForeignKey("uart_profiles.id"), nullable=True)

    profile = relationship("UartProfile", back_populates="raw_data")
    point = relationship("TelemetryPoint", back_populates="raw", uselist=False)


class TelemetryPoint(Base):
    __tablename__ = "telemetry_points"

    id = Column(Integer, primary_key=True, index=True)
    received_at = Column(DateTime, index=True)
    raw_id = Column(Integer, ForeignKey("telemetry_raw.id"), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    altitude = Column(Float, nullable=True)
    barometric_pressure = Column(Float, nullable=True)
    rssi = Column(Float, nullable=True)
    mode = Column(String(50), nullable=True)
    battery = Column(String(50), nullable=True)
    logging_status = Column(String(20), nullable=True)
    wifi_status = Column(String(20), nullable=True)
    gnss_status = Column(String(20), nullable=True)
    payload_json = Column(JSON, nullable=True)

    raw = relationship("TelemetryRaw", back_populates="point")


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    widgets = relationship("Widget", back_populates="dashboard", cascade="all, delete-orphan")


class Widget(Base):
    __tablename__ = "widgets"

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    widget_type = Column(String(50), nullable=False)  # map, graph, status, table
    title = Column(String(100), nullable=True)
    config = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    dashboard = relationship("Dashboard", back_populates="widgets")
    layouts = relationship("WidgetLayout", back_populates="widget", cascade="all, delete-orphan")


class WidgetLayout(Base):
    __tablename__ = "widget_layouts"

    id = Column(Integer, primary_key=True, index=True)
    widget_id = Column(Integer, ForeignKey("widgets.id"), nullable=False)
    device_profile = Column(String(20), nullable=False, default="desktop")  # desktop, tablet, mobile
    area = Column(String(50), nullable=False, default="center")
    order_value = Column(Integer, nullable=False, default=0)
    width_units = Column(Integer, nullable=False, default=1)
    height_units = Column(Integer, nullable=False, default=1)
    visibility = Column(Boolean, default=True)

    widget = relationship("Widget", back_populates="layouts")


class OfflineMapPackage(Base):
    __tablename__ = "offline_map_packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    format_type = Column(String(20), nullable=False, default="pmtiles")  # pmtiles, mbtiles
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    min_zoom = Column(Integer, nullable=True)
    max_zoom = Column(Integer, nullable=True)
    min_lat = Column(Float, nullable=True)
    max_lat = Column(Float, nullable=True)
    min_lon = Column(Float, nullable=True)
    max_lon = Column(Float, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), nullable=False, unique=True)
    value = Column(JSON, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
