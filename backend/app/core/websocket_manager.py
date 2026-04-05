"""
WebSocket connection manager for broadcasting telemetry to all connected clients.
"""
import asyncio
import json
import logging
from typing import List, Dict, Any
from datetime import datetime
from fastapi import WebSocket

logger = logging.getLogger(__name__)


def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class WebSocketManager:
    def __init__(self):
        self._connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self._connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self._connections:
                self._connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self._connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast JSON message to all connected clients."""
        if not self._connections:
            return
        
        data = json.dumps(message, default=json_serializer)
        dead: List[WebSocket] = []
        
        async with self._lock:
            connections = list(self._connections)
        
        for ws in connections:
            try:
                await ws.send_text(data)
            except Exception as e:
                logger.warning(f"WebSocket send failed: {e}")
                dead.append(ws)
        
        if dead:
            async with self._lock:
                for ws in dead:
                    if ws in self._connections:
                        self._connections.remove(ws)

    async def broadcast_telemetry(self, point_data: Dict[str, Any]):
        await self.broadcast({
            "type": "telemetry",
            "data": point_data,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def broadcast_status(self, status_data: Dict[str, Any]):
        await self.broadcast({
            "type": "status",
            "data": status_data,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def connection_count(self) -> int:
        return len(self._connections)


# Global singleton
ws_manager = WebSocketManager()
