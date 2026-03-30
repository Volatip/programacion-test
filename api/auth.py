from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
import secrets
from . import schemas, database, models, runtime_config

# Monkey patch for bcrypt > 4.0.0 compatibility with passlib
import bcrypt
if not hasattr(bcrypt, "__about__"):
    class About:
        __version__ = getattr(bcrypt, "__version__", "unknown")
    setattr(bcrypt, "__about__", About())

runtime_config.load_environment()

SECRET_KEY: str = runtime_config.get_secret_key()
ALGORITHM = runtime_config.get_env("ALGORITHM", "HS256") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(runtime_config.get_env("ACCESS_TOKEN_EXPIRE_MINUTES", "30") or "30")
REFRESH_TOKEN_EXPIRE_DAYS = int(runtime_config.get_env("REFRESH_TOKEN_EXPIRE_DAYS", "7") or "7")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/users/login")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire, "type": "access", "jti": secrets.token_urlsafe(16)})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh", "jti": secrets.token_urlsafe(16)})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_user_from_token(token: str, db: Session, expected_type: str = "access"):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    revoked = db.query(models.RevokedToken).filter(models.RevokedToken.token == token).first()
    if revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        rut = payload.get("sub")
        token_type = payload.get("type")

        if not isinstance(rut, str) or not isinstance(token_type, str) or token_type != expected_type:
            raise credentials_exception

        token_data = schemas.TokenData(rut=rut)
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.rut == token_data.rut).first()
    if user is None:
        raise credentials_exception
    return user


def require_active_user(user: models.User):
    current_status = getattr(user, "status", None)
    if not isinstance(current_status, str) or current_status != "activo":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return user


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    return get_user_from_token(token, db, expected_type="access")


async def get_current_active_user(current_user: models.User = Depends(get_current_user)):
    return require_active_user(current_user)


async def get_current_admin_user(current_user: models.User = Depends(get_current_active_user)):
    current_role = getattr(current_user, "role", None)
    if not isinstance(current_role, str) or current_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user
