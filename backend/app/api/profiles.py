from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db.base import get_db
from ..db.models import UartProfile, UartProfileField
from ..schemas.profile import (
    UartProfileCreate, UartProfileUpdate, UartProfileResponse,
    ValidateSampleRequest, ValidateSampleResponse,
)
from ..core.parser import parse_line

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


def _get_profile_or_404(db: Session, profile_id: int) -> UartProfile:
    profile = db.query(UartProfile).filter(UartProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.get("", response_model=List[UartProfileResponse])
def list_profiles(db: Session = Depends(get_db)):
    return db.query(UartProfile).all()


@router.post("", response_model=UartProfileResponse, status_code=201)
def create_profile(req: UartProfileCreate, db: Session = Depends(get_db)):
    if req.is_default:
        db.query(UartProfile).update({"is_default": False})
    
    profile = UartProfile(
        name=req.name,
        description=req.description,
        delimiter=req.delimiter,
        encoding=req.encoding,
        newline=req.newline,
        is_default=req.is_default,
    )
    db.add(profile)
    db.flush()
    
    for f in req.fields:
        field = UartProfileField(profile_id=profile.id, **f.model_dump())
        db.add(field)
    
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{profile_id}", response_model=UartProfileResponse)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    return _get_profile_or_404(db, profile_id)


@router.patch("/{profile_id}", response_model=UartProfileResponse)
def update_profile(profile_id: int, req: UartProfileUpdate, db: Session = Depends(get_db)):
    profile = _get_profile_or_404(db, profile_id)
    
    if req.is_default:
        db.query(UartProfile).filter(UartProfile.id != profile_id).update({"is_default": False})
    
    update_data = req.model_dump(exclude_unset=True, exclude={"fields"})
    for k, v in update_data.items():
        setattr(profile, k, v)
    
    if req.fields is not None:
        # Replace all fields
        db.query(UartProfileField).filter(UartProfileField.profile_id == profile_id).delete()
        for f in req.fields:
            field = UartProfileField(profile_id=profile.id, **f.model_dump())
            db.add(field)
    
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = _get_profile_or_404(db, profile_id)
    db.delete(profile)
    db.commit()


@router.post("/{profile_id}/validate-sample", response_model=ValidateSampleResponse)
def validate_sample(
    profile_id: int,
    req: ValidateSampleRequest,
    db: Session = Depends(get_db),
):
    profile = _get_profile_or_404(db, profile_id)
    profile_dict = {
        "delimiter": profile.delimiter,
        "fields": [
            {
                "order_index": f.order_index,
                "key": f.key,
                "field_type": f.field_type,
                "is_latitude": f.is_latitude,
                "is_longitude": f.is_longitude,
                "is_altitude": f.is_altitude,
            }
            for f in profile.fields
        ],
    }
    
    try:
        parsed = parse_line(req.sample_line, profile_dict)
        errors = parsed.pop("_parse_errors", None)
        return ValidateSampleResponse(
            success=True,
            parsed=parsed,
            error="; ".join(errors) if errors else None,
        )
    except Exception as e:
        return ValidateSampleResponse(success=False, error=str(e))
