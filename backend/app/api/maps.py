import os
import sqlite3
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import aiofiles

from ..db.base import get_db
from ..db.models import OfflineMapPackage
from ..schemas.maps import OfflineMapPackageCreate, OfflineMapPackageResponse

router = APIRouter(prefix="/api/maps", tags=["maps"])

MAPS_DIR = os.environ.get("MAPS_DIR", "./data/maps")
os.makedirs(MAPS_DIR, exist_ok=True)

# MBTiles raster formats → Content-Type
RASTER_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _mbtiles_tile_format(conn: sqlite3.Connection) -> str:
    """Read the tile format from MBTiles metadata table.
    Returns 'pbf' (vector) or one of 'jpg','png','webp' (raster).
    Falls back to format detection from raw tile bytes if metadata is absent.
    """
    try:
        row = conn.execute("SELECT value FROM metadata WHERE name='format'").fetchone()
        if row:
            return row[0].lower()
    except Exception:
        pass

    # Heuristic: sample the first tile and check for gzip magic (vector) or image headers
    try:
        row = conn.execute("SELECT tile_data FROM tiles LIMIT 1").fetchone()
        if row:
            data: bytes = row[0]
            if data[:2] == b'\x1f\x8b':
                return 'pbf'       # gzip-compressed protobuf → vector
            if data[:8] == b'\x89PNG\r\n\x1a\n':
                return 'png'
            if data[:2] == b'\xff\xd8':
                return 'jpg'       # JPEG SOI marker
            if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
                return 'webp'
    except Exception:
        pass

    return 'pbf'  # safest default


@router.get("/active")
def get_active_package(db: Session = Depends(get_db)):
    """Return the currently active offline map package, or null."""
    pkg = db.query(OfflineMapPackage).filter(OfflineMapPackage.is_active == True).first()
    if not pkg:
        return None

    # Detect tile format for raster packages
    tile_format = None
    if pkg.format_type == "mbtiles" and os.path.exists(pkg.file_path):
        try:
            conn = sqlite3.connect(pkg.file_path)
            tile_format = _mbtiles_tile_format(conn)
            conn.close()
        except Exception:
            pass

    return {
        "id": pkg.id,
        "name": pkg.name,
        "format_type": pkg.format_type,
        "tile_format": tile_format,           # 'pbf' | 'jpg' | 'png' | 'webp' | None
        "is_raster": tile_format in RASTER_CONTENT_TYPES,
        "tile_url_template": f"/api/maps/tiles/{pkg.id}/{{z}}/{{x}}/{{y}}",
    }


@router.get("/offline-packages", response_model=List[OfflineMapPackageResponse])
def list_packages(db: Session = Depends(get_db)):
    return db.query(OfflineMapPackage).all()


@router.post("/offline-packages", response_model=OfflineMapPackageResponse, status_code=201)
async def upload_package(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    format_type: str = Form("mbtiles"),
    min_zoom: Optional[int] = Form(None),
    max_zoom: Optional[int] = Form(None),
    min_lat: Optional[float] = Form(None),
    max_lat: Optional[float] = Form(None),
    min_lon: Optional[float] = Form(None),
    max_lon: Optional[float] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    safe_name = "".join(c for c in name if c.isalnum() or c in "._- ")
    file_path = os.path.join(MAPS_DIR, f"{safe_name}.{format_type}")

    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    pkg = OfflineMapPackage(
        name=name,
        description=description,
        format_type=format_type,
        file_path=file_path,
        file_size=len(content),
        min_zoom=min_zoom,
        max_zoom=max_zoom,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return pkg


@router.post("/offline-packages/{package_id}/activate")
def activate_package(package_id: int, db: Session = Depends(get_db)):
    pkg = db.query(OfflineMapPackage).filter(OfflineMapPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    db.query(OfflineMapPackage).update({"is_active": False})
    pkg.is_active = True
    db.commit()
    return {"status": "activated", "id": package_id}


@router.post("/offline-packages/{package_id}/deactivate")
def deactivate_package(package_id: int, db: Session = Depends(get_db)):
    pkg = db.query(OfflineMapPackage).filter(OfflineMapPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    pkg.is_active = False
    db.commit()
    return {"status": "deactivated", "id": package_id}


@router.delete("/offline-packages/{package_id}", status_code=204)
def delete_package(package_id: int, db: Session = Depends(get_db)):
    pkg = db.query(OfflineMapPackage).filter(OfflineMapPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    if os.path.exists(pkg.file_path):
        os.remove(pkg.file_path)
    db.delete(pkg)
    db.commit()


@router.get("/tiles/{package_id}/{z}/{x}/{y}")
async def get_tile(
    package_id: int, z: int, x: int, y: int,
    db: Session = Depends(get_db),
):
    """Serve a single map tile from an MBTiles package.

    Supports both raster (JPEG/PNG/WebP) and vector (PBF) MBTiles.
    The tile format is auto-detected from the MBTiles metadata table.
    """
    pkg = db.query(OfflineMapPackage).filter(OfflineMapPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")

    if pkg.format_type != "mbtiles":
        raise HTTPException(400, "Direct tile serving is only supported for MBTiles packages.")

    if not os.path.exists(pkg.file_path):
        raise HTTPException(404, "Package file not found on disk")

    try:
        conn = sqlite3.connect(pkg.file_path)
        tile_format = _mbtiles_tile_format(conn)

        # MBTiles uses TMS y-coordinate (origin at bottom-left)
        tms_y = (1 << z) - 1 - y
        row = conn.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
            (z, x, tms_y),
        ).fetchone()
        conn.close()
    except Exception as e:
        raise HTTPException(500, f"MBTiles read error: {e}")

    if not row:
        raise HTTPException(404, "Tile not found")

    data: bytes = row[0]
    cache_headers = {"Cache-Control": "public, max-age=86400"}

    if tile_format in RASTER_CONTENT_TYPES:
        return Response(
            content=data,
            media_type=RASTER_CONTENT_TYPES[tile_format],
            headers=cache_headers,
        )
    else:
        # Vector tiles (PBF) — gzip-compressed protobuf
        return Response(
            content=data,
            media_type="application/x-protobuf",
            headers={"Content-Encoding": "gzip", **cache_headers},
        )
