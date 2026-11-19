import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock

from bson import ObjectId
from fastapi import HTTPException
import pytest

from app.main import update_manifest
from app.schemas import ManifestUpdate


def test_update_manifest_synchronizes_date_with_shipments():
    manifest_id = str(ObjectId())
    current = {
        "_id": ObjectId(manifest_id),
        "name": "Manifiesto semanal",
        "manifest_date": "2026-08-29",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    updated = {**current, "manifest_date": "2026-09-01"}
    database = SimpleNamespace(
        manifests=SimpleNamespace(
            find_one=AsyncMock(side_effect=[current, updated]),
            update_one=AsyncMock(),
        ),
        bags=SimpleNamespace(count_documents=AsyncMock(return_value=2)),
        shipments=SimpleNamespace(
            update_many=AsyncMock(),
            count_documents=AsyncMock(return_value=7),
            distinct=AsyncMock(return_value=[12, 34]),
            find_one=AsyncMock(return_value=None),
        ),
    )

    response = asyncio.run(
        update_manifest(
            manifest_id,
            ManifestUpdate(manifest_date="2026-09-01"),
            database,
        )
    )

    assert response["manifest_date"] == "2026-09-01"
    assert response["bag_count"] == 2
    assert response["voucher_count"] == 7
    database.manifests.update_one.assert_awaited_once_with(
        {"_id": ObjectId(manifest_id)},
        {"$set": {"manifest_date": "2026-09-01", "updated_at": ANY}},
    )
    database.shipments.update_many.assert_awaited_once_with(
        {"manifest_id": manifest_id},
        {"$set": {"shipment_date": "2026-09-01", "updated_at": ANY}},
    )


def test_update_manifest_rejects_date_with_used_address():
    manifest_id = str(ObjectId())
    current = {
        "_id": ObjectId(manifest_id),
        "name": "Manifiesto semanal",
        "manifest_date": "2026-08-29",
    }
    database = SimpleNamespace(
        manifests=SimpleNamespace(find_one=AsyncMock(return_value=current), update_one=AsyncMock()),
        shipments=SimpleNamespace(
            distinct=AsyncMock(return_value=[12]),
            find_one=AsyncMock(return_value={"address_number": 12}),
            update_many=AsyncMock(),
        ),
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(update_manifest(manifest_id, ManifestUpdate(manifest_date="2026-09-01"), database))

    assert error.value.status_code == 409
    database.manifests.update_one.assert_not_awaited()
    database.shipments.update_many.assert_not_awaited()
