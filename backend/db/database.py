from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config.settings import settings


database_url = settings.database_url
at_index = database_url.rfind("@")
if at_index > -1:
    database_url = (
        database_url[:at_index]
        .replace("#", "%23")
        .replace("@", "%40")
        + database_url[at_index:]
    )

if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    import models.user          # noqa: F401
    import models.audit_log     # noqa: F401
    import models.analysis_job  # noqa: F401
    import models.case          # noqa: F401

    Base.metadata.create_all(bind=engine)
