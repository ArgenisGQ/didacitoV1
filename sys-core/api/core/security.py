import os

# Bootstrap Django so FastAPI can use django.contrib.auth.hashers
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core_settings.settings")
import django
django.setup()

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from django.contrib.auth.hashers import check_password, make_password
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_key_for_dev_only_12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
MFA_TEMP_TOKEN_EXPIRE_MINUTES = 5
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 15


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Uses Django's password checker so FastAPI validates Django-stored hashes."""
    return check_password(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Uses Django's password hasher so hashes are compatible."""
    return make_password(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, jti: str, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "jti": jti, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_reset_token(email: str, jti: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES))
    to_encode = {"sub": email, "jti": jti, "exp": expire, "type": "reset"}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_mfa_temp_token(user_id: int, email: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=MFA_TEMP_TOKEN_EXPIRE_MINUTES))
    to_encode = {"sub": str(user_id), "email": email, "exp": expire, "type": "mfa_pending"}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}

