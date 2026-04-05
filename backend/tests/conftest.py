import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite:///./test.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    from app.db.models import Base as ModelBase
    ModelBase.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    ModelBase.metadata.drop_all(bind=test_engine)
    import os
    if os.path.exists("./test.db"):
        os.remove("./test.db")


@pytest.fixture
def client(setup_test_db):
    with TestClient(app) as c:
        yield c

@pytest.fixture
def db(setup_test_db):
    db = TestSessionLocal()
    yield db
    db.close()
