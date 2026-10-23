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
    import models.user                    # noqa: F401
    import models.organization            # noqa: F401
    import models.audit_log               # noqa: F401
    import models.analysis_job            # noqa: F401
    import models.case                    # noqa: F401
    import models.case_event              # noqa: F401
    import models.alert                   # noqa: F401
    import models.evidence                # noqa: F401
    import models.service_request         # noqa: F401
    import models.client_report           # noqa: F401
    import models.workflow_instance       # noqa: F401
    import models.activity_timeline       # noqa: F401
    import models.assignment              # noqa: F401
    # New models (Phase 4)
    import models.dataset                 # noqa: F401
    import models.transaction             # noqa: F401
    import models.investigation_note      # noqa: F401
    import models.investigation_hypothesis # noqa: F401
    import models.investigation_task      # noqa: F401
    import models.investigation_finding   # noqa: F401
    import models.technical_report        # noqa: F401
    import models.investigation_report    # noqa: F401
    import models.report_version          # noqa: F401
    import models.notification            # noqa: F401
    import models.message                 # noqa: F401
    import models.liveshield              # noqa: F401
    import models.case_assignment         # noqa: F401
    import models.report_release          # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Automatic column alignment for existing tables
    try:
        from sqlalchemy import inspect, text
        with engine.connect() as conn:
            inspector = inspect(conn)
            tables = inspector.get_table_names()
            
            # 1. liveshield_simulations
            if "liveshield_simulations" in tables:
                cols = [c["name"] for c in inspector.get_columns("liveshield_simulations")]
                if "detection_mode" not in cols:
                    conn.execute(text("ALTER TABLE liveshield_simulations ADD COLUMN detection_mode VARCHAR(50) DEFAULT 'shadow'"))
                if "detection_config" not in cols:
                    conn.execute(text("ALTER TABLE liveshield_simulations ADD COLUMN detection_config JSON"))
                if "case_id" not in cols:
                    conn.execute(text("ALTER TABLE liveshield_simulations ADD COLUMN case_id INTEGER"))
                if "case_creation_policy" not in cols:
                    conn.execute(text("ALTER TABLE liveshield_simulations ADD COLUMN case_creation_policy VARCHAR(50) DEFAULT 'NONE'"))
                if "target_organization_id" not in cols:
                    conn.execute(text("ALTER TABLE liveshield_simulations ADD COLUMN target_organization_id INTEGER"))
                conn.commit()

            # 2. liveshield_presets
            if "liveshield_presets" in tables:
                cols = [c["name"] for c in inspector.get_columns("liveshield_presets")]
                if "detection_config" not in cols:
                    conn.execute(text("ALTER TABLE liveshield_presets ADD COLUMN detection_config JSON"))
                conn.commit()

            # 3. cases
            if "cases" in tables:
                cols = [c["name"] for c in inspector.get_columns("cases")]
                if "case_origin" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN case_origin VARCHAR(50) DEFAULT 'MANUAL_INTERNAL'"))
                if "is_synthetic" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN is_synthetic BOOLEAN DEFAULT 0"))
                if "simulation_id" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN simulation_id INTEGER"))
                if "closure_reviewed_by_id" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN closure_reviewed_by_id INTEGER"))
                if "closure_reviewed_at" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN closure_reviewed_at DATETIME"))
                if "closure_notes" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN closure_notes TEXT"))
                if "self_approval_exception" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN self_approval_exception BOOLEAN DEFAULT 0"))
                if "self_approval_reason" not in cols:
                    conn.execute(text("ALTER TABLE cases ADD COLUMN self_approval_reason TEXT"))
                conn.commit()
    except Exception as e:
        print(f"[init_db] Warning during schema migration check: {e}")


