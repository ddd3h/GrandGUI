"""
UART receiver abstraction. Supports physical serial, virtual serial, and simulator modes.
All sources produce lines via a common async callback interface.
"""
import asyncio
import logging
from typing import Callable, Awaitable, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class UartReceiver:
    """
    Receives UART data from physical/virtual serial port or simulator.
    All modes use the same line-callback interface.
    """

    def __init__(
        self,
        source_type: str = "simulator",
        port_name: Optional[str] = None,
        baudrate: int = 9600,
        data_bits: int = 8,
        stop_bits: float = 1.0,
        parity: str = "N",
        timeout: float = 1.0,
        encoding: str = "utf-8",
        auto_reconnect: bool = False,
        reconnect_interval: int = 5,
        simulator_interval: float = 1.0,
    ):
        self.source_type = source_type
        self.port_name = port_name
        self.baudrate = baudrate
        self.data_bits = data_bits
        self.stop_bits = stop_bits
        self.parity = parity
        self.timeout = timeout
        self.encoding = encoding
        self.auto_reconnect = auto_reconnect
        self.reconnect_interval = reconnect_interval
        self.simulator_interval = simulator_interval
        
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.last_error: Optional[str] = None
        self.last_received_at: Optional[datetime] = None

    async def start(self, line_callback: Callable[[str, str, Optional[str]], Awaitable[None]]):
        """
        Start receiving. callback(line, source_type, port_name) is called for each line.
        """
        self._running = True
        if self.source_type == "simulator":
            self._task = asyncio.create_task(self._run_simulator(line_callback))
        else:
            self._task = asyncio.create_task(self._run_serial(line_callback))

    async def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def is_running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    async def _run_simulator(self, callback: Callable[[str, str, Optional[str]], Awaitable[None]]):
        from .simulator import TelemetrySimulator
        sim = TelemetrySimulator(interval=self.simulator_interval)
        
        async def on_line(line: str):
            self.last_received_at = datetime.utcnow()
            self.last_error = None
            await callback(line, "simulator", None)
        
        try:
            await sim.run(on_line)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Simulator error: {e}")
            self.last_error = str(e)
        finally:
            self._running = False

    async def _run_serial(self, callback: Callable[[str, str, Optional[str]], Awaitable[None]]):
        """Read from physical or virtual serial port."""
        import serial
        import serial.tools.list_ports
        
        while self._running:
            ser = None
            try:
                ser = serial.Serial(
                    port=self.port_name,
                    baudrate=self.baudrate,
                    bytesize=self.data_bits,
                    stopbits=self.stop_bits,
                    parity=self.parity,
                    timeout=self.timeout,
                )
                logger.info(f"Connected to {self.port_name} at {self.baudrate} baud")
                self.last_error = None
                
                while self._running:
                    line_bytes = await asyncio.get_event_loop().run_in_executor(
                        None, ser.readline
                    )
                    if line_bytes:
                        line = line_bytes.decode(self.encoding, errors="replace").strip()
                        if line:
                            self.last_received_at = datetime.utcnow()
                            await callback(line, self.source_type, self.port_name)
                    
            except serial.SerialException as e:
                logger.error(f"Serial error: {e}")
                self.last_error = str(e)
                if ser:
                    try:
                        ser.close()
                    except Exception:
                        pass
                
                if self.auto_reconnect and self._running:
                    logger.info(f"Reconnecting in {self.reconnect_interval}s...")
                    await asyncio.sleep(self.reconnect_interval)
                else:
                    self._running = False
                    break
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                self.last_error = str(e)
                self._running = False
                break
            finally:
                if ser and ser.is_open:
                    ser.close()


def list_serial_ports():
    """List available serial ports."""
    try:
        import serial.tools.list_ports
        ports = serial.tools.list_ports.comports()
        return [
            {
                "port": p.device,
                "description": p.description,
                "hwid": p.hwid,
            }
            for p in ports
        ]
    except Exception as e:
        logger.error(f"Error listing ports: {e}")
        return []
