import { create } from 'zustand';
import type { TelemetryPoint, SerialStatus, WsMessage } from '../types';

const MAX_TRACK_POINTS = 1000;
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/telemetry`;

interface TelemetryState {
  latest: TelemetryPoint | null;
  history: TelemetryPoint[];
  serialStatus: SerialStatus;
  wsConnected: boolean;

  setLatest: (p: TelemetryPoint) => void;
  appendHistory: (p: TelemetryPoint) => void;
  setHistory: (pts: TelemetryPoint[]) => void;
  setSerialStatus: (s: Partial<SerialStatus>) => void;
  setWsConnected: (v: boolean) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  latest: null,
  history: [],
  serialStatus: { connected: false },
  wsConnected: false,

  setLatest: (p) => set({ latest: p }),
  appendHistory: (p) =>
    set((state) => {
      const history = [...state.history, p];
      if (history.length > MAX_TRACK_POINTS) {
        return { history: history.slice(history.length - MAX_TRACK_POINTS) };
      }
      return { history };
    }),
  setHistory: (pts) => set({ history: pts }),
  setSerialStatus: (s) =>
    set((state) => ({ serialStatus: { ...state.serialStatus, ...s } })),
  setWsConnected: (v) => set({ wsConnected: v }),
}));

// WebSocket singleton
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectWs() {
  if (ws && ws.readyState !== WebSocket.CLOSED) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    useTelemetryStore.getState().setWsConnected(true);
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };

  ws.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data);
      if (msg.type === 'telemetry') {
        const point = msg.data as TelemetryPoint;
        useTelemetryStore.getState().setLatest(point);
        useTelemetryStore.getState().appendHistory(point);
      }
    } catch (_) {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    useTelemetryStore.getState().setWsConnected(false);
    reconnectTimer = setTimeout(connectWs, 3000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

// Auto-start WebSocket
connectWs();

export { connectWs };
