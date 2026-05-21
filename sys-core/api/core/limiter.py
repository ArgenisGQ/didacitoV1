import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Global slowapi limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    enabled=os.getenv("DISABLE_RATE_LIMIT", "false").lower() != "true"
)
