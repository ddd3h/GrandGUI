"""Tests for simulator module."""
import asyncio
import pytest
from app.core.simulator import TelemetrySimulator


class TestSimulator:
    def test_generate_line_format(self):
        sim = TelemetrySimulator(interval=1.0)
        line = sim._generate_line()
        parts = [p.strip() for p in line.split(",")]
        assert len(parts) == 10
        # First two should be parseable floats (lat, lon)
        float(parts[0])
        float(parts[1])

    def test_step_increments(self):
        sim = TelemetrySimulator(interval=1.0)
        sim._generate_line()
        assert sim._step == 1
        sim._generate_line()
        assert sim._step == 2

    def test_position_changes(self):
        sim = TelemetrySimulator(interval=1.0)
        line1 = sim._generate_line()
        for _ in range(10):
            sim._generate_line()
        line11 = sim._generate_line()
        # Lines should be different (position changes)
        assert line1 != line11

    @pytest.mark.asyncio
    async def test_run_produces_lines(self):
        sim = TelemetrySimulator(interval=0.05)
        received = []
        
        async def collect(line):
            received.append(line)
            if len(received) >= 3:
                sim.stop()
        
        await asyncio.wait_for(sim.run(collect), timeout=2.0)
        assert len(received) >= 3
        for line in received:
            assert "," in line
