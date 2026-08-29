import pytest
from pydantic import ValidationError

from app.config import Settings


def test_testing_environment_accepts_container_mongo():
    settings = Settings(
        _env_file=None,
        app_env="testing",
        mongo_url="mongodb://mongo:27017",
    )

    assert settings.app_env == "testing"


def test_production_environment_rejects_local_mongo():
    with pytest.raises(ValidationError, match="no puede utilizar MongoDB local"):
        Settings(
            _env_file=None,
            app_env="production",
            mongo_url="mongodb://mongo:27017",
        )


def test_production_environment_accepts_atlas():
    settings = Settings(
        _env_file=None,
        app_env="production",
        mongo_url="mongodb+srv://user:password@cluster.example.mongodb.net/",
        seed_from_workbook=False,
    )

    assert settings.app_env == "production"
    assert settings.seed_from_workbook is False

