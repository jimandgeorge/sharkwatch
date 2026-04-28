import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from .config import settings

# Strip query params — asyncpg handles SSL via connect_args
_url = settings.database_url.split("?")[0]

# Dev: skip cert verification (Windows CA store often missing Neon's chain)
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

engine = create_async_engine(
    _url,
    echo=False,
    pool_pre_ping=True,
    connect_args={"ssl": _ssl_ctx, "statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
