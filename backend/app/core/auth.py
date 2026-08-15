from fastapi import Header, HTTPException, status
from .config import settings

def require_user(x_auth_request_user: str | None = Header(default=None)) -> str:
    """Authentication boundary for OAuth2 Proxy or another trusted reverse proxy.

    Development mode is explicit and must not be used in production.
    """
    if settings.auth_mode == "development":
        return x_auth_request_user or "local-development-user"
    if not x_auth_request_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return x_auth_request_user
