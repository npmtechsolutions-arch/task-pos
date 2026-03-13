"""Database package."""

from app.db.base import Base
from app.db.session import get_db_session

# Alias for backwards compatibility
get_db = get_db_session

__all__ = ["Base", "get_db", "get_db_session"]
