// UART Profile types
export interface ColorRule {
  condition: string;
  color: string;
  label?: string;
}

export interface UartProfileField {
  id: number;
  profile_id: number;
  order_index: number;
  key: string;
  label?: string;
  field_type: 'float' | 'int' | 'string' | 'key_value_string';
  unit?: string;
  decimal_places?: number;
  display_format?: string;
  is_latitude: boolean;
  is_longitude: boolean;
  is_altitude: boolean;
  use_for_map: boolean;
  use_for_graph: boolean;
  use_for_status: boolean;
  is_hidden: boolean;
  color_rules?: ColorRule[];
}

export interface UartProfile {
  id: number;
  name: string;
  description?: string;
  delimiter: string;
  encoding: string;
  newline: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  fields: UartProfileField[];
}

// Telemetry types
export interface TelemetryPoint {
  id: number;
  received_at: string;
  raw_id?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  barometric_pressure?: number;
  rssi?: number;
  mode?: string;
  battery?: string;
  logging_status?: string;
  wifi_status?: string;
  gnss_status?: string;
  payload_json?: Record<string, unknown>;
}

// Serial connection types
export interface SerialStatus {
  connected: boolean;
  source_type?: string;
  port_name?: string;
  baudrate?: number;
  last_received_at?: string;
  error_message?: string;
}

export interface ConnectRequest {
  source_type: 'physical' | 'virtual' | 'simulator';
  port_name?: string;
  baudrate: number;
  data_bits: number;
  stop_bits: number;
  parity: string;
  timeout: number;
  encoding: string;
  auto_reconnect: boolean;
  reconnect_interval: number;
  profile_id?: number;
  simulator_interval: number;
}

export interface PortInfo {
  port: string;
  description?: string;
  hwid?: string;
}

// Dashboard types
export interface WidgetLayout {
  id: number;
  widget_id: number;
  device_profile: string;
  area: string;
  order_value: number;
  width_units: number;
  height_units: number;
  visibility: boolean;
}

export interface Widget {
  id: number;
  dashboard_id: number;
  widget_type: 'map' | 'graph' | 'status' | 'table';
  title?: string;
  config?: Record<string, unknown>;
  created_at: string;
  layouts: WidgetLayout[];
}

export interface Dashboard {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  widgets: Widget[];
}

// Map types
export interface ActiveMapPackage {
  id: number;
  name: string;
  format_type: string;
  tile_format: string | null;  // 'jpg' | 'png' | 'webp' | 'pbf' | null
  is_raster: boolean;
  tile_url_template: string;   // e.g. "/api/maps/tiles/1/{z}/{x}/{y}"
}

export interface OfflineMapPackage {
  id: number;
  name: string;
  description?: string;
  format_type: string;
  file_path: string;
  file_size?: number;
  min_zoom?: number;
  max_zoom?: number;
  min_lat?: number;
  max_lat?: number;
  min_lon?: number;
  max_lon?: number;
  is_active: boolean;
  created_at: string;
}

// WebSocket message types
export interface WsMessage {
  type: 'telemetry' | 'status' | 'error';
  data: TelemetryPoint | Record<string, unknown>;
  timestamp: string;
}

// Coordinate display format
export type CoordFormat = 'decimal' | 'dms';

export function toDms(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(2);
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  return `${deg}°${min}'${sec}"${dir}`;
}
