from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db.base import get_db
from ..db.models import Dashboard, Widget, WidgetLayout
from ..schemas.dashboard import (
    DashboardCreate, DashboardResponse,
    WidgetCreate, WidgetUpdate, WidgetResponse,
    WidgetLayoutUpdate, LayoutPatchRequest,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=List[DashboardResponse])
def list_dashboards(db: Session = Depends(get_db)):
    return db.query(Dashboard).all()


@router.post("", response_model=DashboardResponse, status_code=201)
def create_dashboard(req: DashboardCreate, db: Session = Depends(get_db)):
    if req.is_default:
        db.query(Dashboard).update({"is_default": False})
    d = Dashboard(**req.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(dashboard_id: int, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(404, "Dashboard not found")
    return d


@router.patch("/layout")
def patch_layout(req: LayoutPatchRequest, db: Session = Depends(get_db)):
    """Batch update widget layouts."""
    for layout_data in req.layouts:
        widget_id = layout_data.get("widget_id")
        device_profile = layout_data.get("device_profile", "desktop")
        
        layout = db.query(WidgetLayout).filter(
            WidgetLayout.widget_id == widget_id,
            WidgetLayout.device_profile == device_profile,
        ).first()
        
        if layout:
            for k, v in layout_data.items():
                if k not in ("widget_id",) and hasattr(layout, k):
                    setattr(layout, k, v)
        else:
            layout = WidgetLayout(**{k: v for k, v in layout_data.items() if hasattr(WidgetLayout, k)})
            db.add(layout)
    
    db.commit()
    return {"status": "ok"}


router_widgets = APIRouter(prefix="/api/widgets", tags=["widgets"])


@router_widgets.post("", response_model=WidgetResponse, status_code=201)
def create_widget(req: WidgetCreate, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == req.dashboard_id).first()
    if not d:
        raise HTTPException(404, "Dashboard not found")
    
    w = Widget(
        dashboard_id=req.dashboard_id,
        widget_type=req.widget_type,
        title=req.title,
        config=req.config,
    )
    db.add(w)
    db.flush()
    
    for layout_req in req.layouts:
        layout = WidgetLayout(widget_id=w.id, **layout_req.model_dump())
        db.add(layout)
    
    db.commit()
    db.refresh(w)
    return w


@router_widgets.patch("/{widget_id}", response_model=WidgetResponse)
def update_widget(widget_id: int, req: WidgetUpdate, db: Session = Depends(get_db)):
    w = db.query(Widget).filter(Widget.id == widget_id).first()
    if not w:
        raise HTTPException(404, "Widget not found")
    
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(w, k, v)
    
    db.commit()
    db.refresh(w)
    return w


@router_widgets.delete("/{widget_id}", status_code=204)
def delete_widget(widget_id: int, db: Session = Depends(get_db)):
    w = db.query(Widget).filter(Widget.id == widget_id).first()
    if not w:
        raise HTTPException(404, "Widget not found")
    db.delete(w)
    db.commit()
