#!/usr/bin/env python3
"""Virtual UART test data sender for socat-based virtual ports."""
import sys, time, math, random, serial

def generate_line(step):
    t = step * 0.05
    lat = 35.6812 + 0.001 * math.sin(t)
    lon = 139.7671 + 0.001 * math.cos(t)
    alt = 50.0 + 10.0 * math.sin(t * 0.3) + random.uniform(-0.5, 0.5)
    pressure = 1013.25 - alt * 0.12 + random.uniform(-0.5, 0.5)
    rssi = -70 + 10 * math.sin(t * 0.7) + random.uniform(-3, 3)
    mode = ["wait","active","sleep","transmit"][step % 4]
    battery = ["Full","High","Middle","Low"][min(step//30, 3)]
    log_s = "ON" if step % 4 != 0 else "OFF"
    wifi = "OK" if step % 10 < 8 else "NG"
    gnss = "lock" if step > 3 else "unlock"
    return (f"{lat:.6f}, {lon:.6f}, {alt:.1f}, {pressure:.2f}, {rssi:.1f}, "
            f"Mode:{mode}, Bt:{battery}, Log:{log_s}, WiFi:{wifi}, GNSS:{gnss}")

port = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttys003"
interval = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
print(f"Sending to {port} every {interval}s. Ctrl+C to stop.")
with serial.Serial(port, 9600, timeout=1) as ser:
    for step in range(10**9):
        line = generate_line(step)
        ser.write((line + "\n").encode("utf-8"))
        print(f"[{step:04d}] {line}")
        time.sleep(interval)
