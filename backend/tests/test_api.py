"""Integration tests for REST API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestHealth:
    def test_health(self, client: TestClient):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestSerialAPI:
    def test_get_ports(self, client: TestClient):
        r = client.get("/api/serial/ports")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_status_initial(self, client: TestClient):
        r = client.get("/api/serial/status")
        assert r.status_code == 200
        data = r.json()
        assert "connected" in data

    def test_connect_simulator(self, client: TestClient):
        r = client.post("/api/serial/connect", json={
            "source_type": "simulator",
            "baudrate": 9600,
            "simulator_interval": 100.0,  # slow to avoid noise in tests
        })
        assert r.status_code == 200
        assert r.json()["source_type"] == "simulator"

    def test_disconnect(self, client: TestClient):
        r = client.post("/api/serial/disconnect")
        assert r.status_code == 200
        assert r.json()["status"] == "stopped"


class TestProfilesAPI:
    def test_list_profiles(self, client: TestClient):
        r = client.get("/api/profiles")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_profile(self, client: TestClient):
        r = client.post("/api/profiles", json={
            "name": "TestProfile",
            "delimiter": ",",
            "fields": [
                {"order_index": 0, "key": "lat", "field_type": "float", "is_latitude": True,
                 "is_longitude": False, "is_altitude": False},
                {"order_index": 1, "key": "lon", "field_type": "float", "is_latitude": False,
                 "is_longitude": True, "is_altitude": False},
            ]
        })
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "TestProfile"
        assert len(data["fields"]) == 2
        return data["id"]

    def test_get_profile(self, client: TestClient):
        # Create first
        r = client.post("/api/profiles", json={"name": "GetTest", "delimiter": ","})
        assert r.status_code == 201
        pid = r.json()["id"]
        
        r2 = client.get(f"/api/profiles/{pid}")
        assert r2.status_code == 200
        assert r2.json()["id"] == pid

    def test_update_profile(self, client: TestClient):
        r = client.post("/api/profiles", json={"name": "UpdateTest", "delimiter": ","})
        pid = r.json()["id"]
        
        r2 = client.patch(f"/api/profiles/{pid}", json={"description": "updated"})
        assert r2.status_code == 200
        assert r2.json()["description"] == "updated"

    def test_delete_profile(self, client: TestClient):
        r = client.post("/api/profiles", json={"name": "DeleteTest", "delimiter": ","})
        pid = r.json()["id"]
        
        r2 = client.delete(f"/api/profiles/{pid}")
        assert r2.status_code == 204

        r3 = client.get(f"/api/profiles/{pid}")
        assert r3.status_code == 404

    def test_validate_sample(self, client: TestClient):
        r = client.post("/api/profiles", json={
            "name": "ValidateTest",
            "delimiter": ",",
            "fields": [
                {"order_index": 0, "key": "lat", "field_type": "float",
                 "is_latitude": True, "is_longitude": False, "is_altitude": False},
                {"order_index": 1, "key": "lon", "field_type": "float",
                 "is_latitude": False, "is_longitude": True, "is_altitude": False},
            ]
        })
        pid = r.json()["id"]
        
        r2 = client.post(f"/api/profiles/{pid}/validate-sample", json={
            "sample_line": "35.68, 139.76"
        })
        assert r2.status_code == 200
        data = r2.json()
        assert data["success"] is True
        assert data["parsed"]["lat"] == pytest.approx(35.68)
        assert data["parsed"]["lon"] == pytest.approx(139.76)


class TestTelemetryAPI:
    def test_latest_initially_none(self, client: TestClient):
        r = client.get("/api/telemetry/latest")
        assert r.status_code == 200
        # May be None or a point

    def test_history_returns_list(self, client: TestClient):
        r = client.get("/api/telemetry/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_export_csv(self, client: TestClient):
        r = client.get("/api/telemetry/export?format=csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]

    def test_export_json(self, client: TestClient):
        r = client.get("/api/telemetry/export?format=json")
        assert r.status_code == 200
        assert "application/json" in r.headers["content-type"]


class TestDashboardAPI:
    def test_list_dashboards(self, client: TestClient):
        r = client.get("/api/dashboard")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_dashboard(self, client: TestClient):
        r = client.post("/api/dashboard", json={"name": "Test Dashboard"})
        assert r.status_code == 201
        assert r.json()["name"] == "Test Dashboard"

    def test_create_widget(self, client: TestClient):
        r = client.post("/api/dashboard", json={"name": "WidgetDash"})
        dash_id = r.json()["id"]
        
        r2 = client.post("/api/widgets", json={
            "dashboard_id": dash_id,
            "widget_type": "map",
            "title": "My Map",
            "layouts": [{"area": "center", "order_value": 0}],
        })
        assert r2.status_code == 201
        data = r2.json()
        assert data["widget_type"] == "map"
        assert data["title"] == "My Map"

    def test_update_widget(self, client: TestClient):
        r = client.post("/api/dashboard", json={"name": "UpdateWidgetDash"})
        dash_id = r.json()["id"]
        
        r2 = client.post("/api/widgets", json={
            "dashboard_id": dash_id,
            "widget_type": "graph",
            "title": "Original",
        })
        widget_id = r2.json()["id"]
        
        r3 = client.patch(f"/api/widgets/{widget_id}", json={"title": "Updated"})
        assert r3.status_code == 200
        assert r3.json()["title"] == "Updated"

    def test_delete_widget(self, client: TestClient):
        r = client.post("/api/dashboard", json={"name": "DeleteWidgetDash"})
        dash_id = r.json()["id"]
        
        r2 = client.post("/api/widgets", json={
            "dashboard_id": dash_id,
            "widget_type": "status",
            "title": "ToDelete",
        })
        widget_id = r2.json()["id"]
        
        r3 = client.delete(f"/api/widgets/{widget_id}")
        assert r3.status_code == 204

    def test_patch_layout(self, client: TestClient):
        r = client.post("/api/dashboard", json={"name": "LayoutDash"})
        dash_id = r.json()["id"]
        
        r2 = client.post("/api/widgets", json={
            "dashboard_id": dash_id,
            "widget_type": "map",
            "title": "LayoutWidget",
        })
        widget_id = r2.json()["id"]
        
        r3 = client.patch("/api/dashboard/layout", json={
            "layouts": [{
                "widget_id": widget_id,
                "device_profile": "desktop",
                "area": "left",
                "order_value": 0,
                "width_units": 2,
                "height_units": 1,
                "visibility": True,
            }]
        })
        assert r3.status_code == 200


class TestMapsAPI:
    def test_list_packages_empty(self, client: TestClient):
        r = client.get("/api/maps/offline-packages")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
