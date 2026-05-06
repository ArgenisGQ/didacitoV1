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
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Uses Django's password checker so FastAPI validates Django-stored hashes."""
    return check_password(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Uses Django's password hasher so hashes are compatible."""
    return make_password(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}
