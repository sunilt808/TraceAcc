from sqlalchemy import create_engine, MetaData
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

naming_convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}
Base = declarative_base(metadata=MetaData(naming_convention=naming_convention))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    import models.user               # noqa: F401
    import models.organization       # noqa: F401
    import models.audit_log          # noqa: F401
    import models.analysis_job       # noqa: F401
    import models.case               # noqa: F401
    import models.case_event         # noqa: F401
    import models.alert              # noqa: F401
    import models.evidence           # noqa: F401
    import models.service_request    # noqa: F401
    import models.client_report      # noqa: F401
    import models.workflow_instance   # noqa: F401
    import models.activity_timeline  # noqa: F401
    import models.assignment         # noqa: F401

    Base.metadata.create_all(bind=engine)
