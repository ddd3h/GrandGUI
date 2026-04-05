"""
Internal data simulator for testing without physical UART device.
Generates realistic telemetry data that changes over time.
"""
import asyncio
import math
import random
import time
from typing import Callable, Awaitable, Optional
from datetime import datetime


class TelemetrySimulator:
    """Generates synthetic UART-like telemetry lines."""

    def __init__(self, interval: float = 1.0):
        self.interval = interval
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._step = 0
        
        # Trajectory center
        self._base_lat = 35.6812
        self._base_lon = 139.7671
        self._radius = 0.001  # ~100m radius

    def _generate_line(self) -> str:
        t = self._step * 0.05  # slow movement
        lat = self._base_lat + self._radius * math.sin(t)
        lon = self._base_lon + self._radius * math.cos(t)
        altitude = 50.0 + 10.0 * math.sin(t * 0.3) + random.uniform(-0.5, 0.5)
        pressure = 1013.25 - altitude * 0.12 + random.uniform(-0.5, 0.5)
        rssi = -70 + 10 * math.sin(t * 0.7) + random.uniform(-3, 3)
        
        modes = ["wait", "active", "sleep", "transmit"]
        mode = modes[self._step % len(modes)] if self._step % 20 == 0 else modes[min(self._step // 20, len(modes) - 1)]
        
        battery_levels = ["Full", "High", "Middle", "Low", "Critical"]
        battery = battery_levels[min(self._step // 50, len(battery_levels) - 1)]
        
        log_status = "ON" if self._step % 4 != 0 else "OFF"
        wifi = "OK" if self._step % 10 < 8 else "NG"
        gnss = "lock" if self._step > 5 else "unlock"
        
        line = (
            f"{lat:.6f}, {lon:.6f}, {altitude:.1f}, {pressure:.2f}, {rssi:.1f}, "
            f"Mode:{mode}, Bt:{battery}, Log:{log_status}, WiFi:{wifi}, GNSS:{gnss}"
        )
        self._step += 1
        return line

    async def run(self, callback: Callable[[str], Awaitable[None]]):
        """Run simulator, calling callback with each generated line."""
        self._running = True
        self._step = 0
        try:
            while self._running:
                line = self._generate_line()
                await callback(line)
                await asyncio.sleep(self.interval)
        except asyncio.CancelledError:
            pass
        finally:
            self._running = False

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
