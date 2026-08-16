from datetime import datetime, timezone
from hashlib import sha256
from secrets import token_urlsafe
from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from .config import settings
from .db import get_db
from ..models import Session as LoginSession, User

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError):
        return False


def bootstrap_users(db: Session) -> None:
    configured = [
        (settings.cashier_username, settings.cashier_password, "cashier"),
        (settings.admin_username, settings.admin_password, "admin"),
    ]
    for username, password, role in configured:
        if not password:
            raise RuntimeError(f"Missing password configuration for {role}")
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            db.add(User(username=username, password_hash=hash_password(password), role=role))
    db.commit()


def token_digest(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def new_session_token() -> str:
    return token_urlsafe(48)


def _session_user(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    session = db.scalar(select(LoginSession).where(LoginSession.token_hash == token_digest(token)))
    if not session:
        return None
    now = datetime.now(timezone.utc)
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= now or not session.user.is_active:
        db.delete(session)
        db.commit()
        return None
    return session.user


def current_user(
    request: Request,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User:
    user = _session_user(db, session_token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    request.state.user = user
    return user


def require_role(role: str):
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return dependency


def clear_user_sessions(db: Session, user_id: int) -> None:
    db.execute(delete(LoginSession).where(LoginSession.user_id == user_id))
    db.commit()
