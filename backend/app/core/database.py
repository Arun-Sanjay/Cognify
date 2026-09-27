from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)


# ── pgvector adapter registration ──
# pgvector's psycopg2 adapter must be registered on each new DBAPI connection
# so the `vector` type is recognised both for SELECT results and parameter
# binding. Without this, query parameters fall back to text and the `<=>`
# operator silently produces wrong results (zero hits in our case).
if "postgresql" in settings.database_url:
    try:
        from pgvector.psycopg2 import register_vector

        @event.listens_for(engine, "connect")
        def _register_vector_on_connect(dbapi_connection, connection_record):
            register_vector(dbapi_connection)

    except ImportError:
        # pgvector package not installed in this environment — skip silently
        # so SQLite-only test runs still work.
        pass

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
