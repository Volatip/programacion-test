import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from .. import models, schemas, database, auth, session_audit
from ..permissions import PermissionChecker
from ..limiter import limiter

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login(request: Request, user_login: schemas.UserLogin, db: Session = Depends(database.get_db)):
    normalized_rut = auth.normalize_rut(user_login.rut)
    user = db.query(models.User).filter(models.User.rut == normalized_rut).first()
    if user is None or not auth.verify_password(user_login.password, user.password_hash):
        session_audit.log_session_event(
            db,
            request,
            event_type=session_audit.EVENT_LOGIN_FAILURE,
            success=False,
            user=user,
            user_rut=normalized_rut,
            failure_reason="invalid_credentials",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect rut or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.status != "activo":
        session_audit.log_session_event(
            db,
            request,
            event_type=session_audit.EVENT_LOGIN_FAILURE,
            success=False,
            user=user,
            user_rut=user.rut,
            failure_reason="inactive_user",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.rut}, expires_delta=access_token_expires
    )
    
    refresh_token_expires = timedelta(days=auth.REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = auth.create_refresh_token(
        data={"sub": user.rut}, expires_delta=refresh_token_expires
    )
    
    # Update last_access
    setattr(user, "last_access", datetime.now())
    session_audit.log_session_event(
        db,
        request,
        event_type=session_audit.EVENT_LOGIN_SUCCESS,
        success=True,
        user=user,
        token=access_token,
    )
    db.commit()
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "user": user
    }

@router.post("/refresh", response_model=schemas.Token)
@limiter.limit("10/minute")
def refresh_token(request: Request, refresh_data: schemas.TokenRefresh, db: Session = Depends(database.get_db)):
    """
    Get a new access token using a refresh token.
    """
    user = auth.get_user_from_token(refresh_data.refresh_token, db, expected_type="refresh")
    auth.require_active_user(user)
        
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.rut}, expires_delta=access_token_expires
    )
    refresh_token_expires = timedelta(days=auth.REFRESH_TOKEN_EXPIRE_DAYS)
    new_refresh_token = auth.create_refresh_token(
        data={"sub": user.rut}, expires_delta=refresh_token_expires
    )

    auth.revoke_token(db, refresh_data.refresh_token)
    session_audit.log_session_event(
        db,
        request,
        event_type=session_audit.EVENT_REFRESH_SUCCESS,
        success=True,
        user=user,
        token=access_token,
    )
    db.commit()
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "refresh_token": new_refresh_token,
        "user": user
    }

@router.post("/logout")
def logout(
    request: Request,
    logout_data: schemas.LogoutRequest | None = None,
    current_user: models.User = Depends(auth.get_current_active_user),
    token: str = Depends(auth.oauth2_scheme),
    db: Session = Depends(database.get_db)
):
    """
    Blacklist the current token.
    """
    auth.revoke_token(db, token)
    if logout_data and logout_data.refresh_token:
        auth.revoke_token(db, logout_data.refresh_token)
    session_audit.log_session_event(
        db,
        request,
        event_type=session_audit.EVENT_LOGOUT,
        success=True,
        user=current_user,
        token=token,
    )
    db.commit()
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(
    request: Request,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(database.get_db),
):
    session_audit.log_session_event(
        db,
        request,
        event_type=session_audit.EVENT_SESSION_VALIDATED,
        success=True,
        user=current_user,
    )
    db.commit()
    return current_user


@router.get("/session-events", response_model=List[schemas.SessionAuditEventResponse])
def read_session_events(
    skip: int = 0,
    limit: int = 100,
    user_id: int | None = None,
    event_type: str | None = None,
    success: bool | None = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_users(current_user)
    bounded_limit = max(1, min(limit, 200))
    return (
        session_audit.build_session_events_query(
            db,
            user_id=user_id,
            event_type=event_type,
            success=success,
        )
        .offset(skip)
        .limit(bounded_limit)
        .all()
    )

@router.get("", response_model=List[schemas.UserResponse])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.check_can_manage_users(current_user)
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=schemas.UserResponse)
def read_user(
    user_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.check_can_manage_users(current_user)
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.post("", response_model=schemas.UserResponse)
def create_user(
    user: schemas.UserCreate, 
    db: Session = Depends(database.get_db),
    # Solo admins pueden crear usuarios, o dejar abierto para registro inicial? 
    # Por seguridad, restringiremos a admin.
    # Si es el primer usuario, se crea con script aparte.
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_rut = db.query(models.User).filter(models.User.rut == user.rut).first()
    if db_rut:
        raise HTTPException(status_code=400, detail="RUT already registered")

    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=user.email, 
        password_hash=hashed_password,
        name=user.name,
        rut=user.rut,
        role=user.role,
        status=user.status
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception:
        db.rollback()
        logger.exception("Error creating user")
        raise HTTPException(status_code=500, detail="Error creating user")

@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int, 
    user_update: schemas.UserUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Solo admin o el mismo usuario pueden editar
    if current_user.role != "admin" and int(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    
    if "password" in update_data and isinstance(update_data["password"], str) and update_data["password"]:
        update_data["password_hash"] = auth.get_password_hash(update_data["password"])
        del update_data["password"]
    
    # Prevenir que un usuario normal se vuelva admin
    if "role" in update_data and current_user.role != "admin":
         del update_data["role"]

    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/{user_id}")
def delete_user(
    user_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}
