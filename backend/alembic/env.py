from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy import create_engine

from app.core.config import get_settings
from app.core.database import Base
import app.models  # noqa: F401  Ensures model modules are imported for autogenerate.

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config
settings = get_settings()

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

target_metadata = Base.metadata


def _configure_context(connection: Connection | None = None) -> None:
    configure_kwargs = {
        "target_metadata": target_metadata,
        "compare_type": True,
        "compare_server_default": True,
    }

    if connection is not None:
        configure_kwargs["connection"] = connection
    else:
        configure_kwargs["url"] = config.get_main_option("sqlalchemy.url")
        configure_kwargs["literal_binds"] = True
        configure_kwargs["dialect_opts"] = {"paramstyle": "named"}

    context.configure(**configure_kwargs)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    _configure_context()

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = create_engine(
        settings.database_url,
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        _configure_context(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
