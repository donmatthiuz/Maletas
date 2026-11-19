import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.main import create_shipment, resolve_random_address, update_shipment
from app.schemas import ShipmentCreate, ShipmentUpdate
from app.services.address_assignment import DAILY_ADDRESS_INDEX, ensure_unique_daily_addresses


class AsyncCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, _fields):
        return self

    def __aiter__(self):
        return self._items()

    async def _items(self):
        for item in self.documents:
            yield item


def test_random_address_excludes_every_manifest_on_same_date():
    database = SimpleNamespace(
        shipments=SimpleNamespace(distinct=AsyncMock(return_value=[1, 2])),
        addresses=SimpleNamespace(aggregate=Mock(return_value=AsyncCursor([
            {"number": 3, "address": "Dirección 3", "phone": "12345678"}
        ]))),
    )

    address = asyncio.run(resolve_random_address(database, "2026-11-19"))

    assert address["number"] == 3
    database.shipments.distinct.assert_awaited_once_with(
        "address_number",
        {"shipment_date": "2026-11-19", "manifest_id": {"$type": "string"}},
    )
    assert database.addresses.aggregate.call_args.args[0][0] == {
        "$match": {"number": {"$nin": [1, 2]}}
    }


def test_create_retries_when_another_request_claims_the_address():
    manifest_id = ObjectId()
    bag_id = ObjectId()
    shipment_id = ObjectId()
    attempts = []

    async def insert(document):
        attempts.append(document.copy())
        if len(attempts) == 1:
            raise DuplicateKeyError("address claimed")
        return SimpleNamespace(inserted_id=shipment_id)

    database = SimpleNamespace(
        bags=SimpleNamespace(find_one=AsyncMock(return_value={
            "_id": bag_id, "manifest_id": str(manifest_id), "number": 1, "attendant": "Encargado"
        })),
        manifests=SimpleNamespace(find_one=AsyncMock(return_value={
            "_id": manifest_id, "manifest_date": "2026-11-19"
        })),
        addresses=SimpleNamespace(aggregate=Mock(side_effect=[
            AsyncCursor([{"number": 2, "address": "Dirección 2", "phone": "12345678"}]),
            AsyncCursor([{"number": 3, "address": "Dirección 3", "phone": "12345678"}]),
        ])),
        shipments=SimpleNamespace(
            distinct=AsyncMock(side_effect=[[1], [1, 2]]),
            find_one=AsyncMock(side_effect=[None, {"_id": shipment_id, "address_number": 3}]),
            insert_one=AsyncMock(side_effect=insert),
        ),
    )
    payload = ShipmentCreate(
        code="ABC", bag_number=1, bag_id=str(bag_id),
        shipper_name="Remitente", shipper_address="Ciudad de Guatemala",
        consignee_name="Destinatario", contents="Ropa", attendant="Encargado",
    )

    result = asyncio.run(create_shipment(payload, database))

    assert [item["address_number"] for item in attempts] == [2, 3]
    assert result["address_number"] == 3
    assert all(item["shipment_date"] == "2026-11-19" for item in attempts)


def test_move_to_another_manifest_on_same_date_keeps_address():
    shipment_id, bag_id, manifest_id = ObjectId(), ObjectId(), ObjectId()
    current = {
        "_id": shipment_id,
        "manifest_id": str(ObjectId()),
        "shipment_date": "2026-11-19",
        "address_number": 7,
    }
    updated = current.copy()

    async def update(_query, change):
        updated.update(change["$set"])

    database = SimpleNamespace(
        bags=SimpleNamespace(find_one=AsyncMock(return_value={
            "_id": bag_id, "manifest_id": str(manifest_id), "number": 2, "attendant": "Encargado"
        })),
        manifests=SimpleNamespace(find_one=AsyncMock(return_value={
            "_id": manifest_id, "manifest_date": "2026-11-19"
        })),
        shipments=SimpleNamespace(find_one=AsyncMock(side_effect=[current, updated]), update_one=AsyncMock(side_effect=update)),
    )

    result = asyncio.run(update_shipment(str(shipment_id), ShipmentUpdate(bag_id=str(bag_id)), database))

    assert result["manifest_id"] == str(manifest_id)
    assert result["address_number"] == 7
    assert "address_number" not in database.shipments.update_one.call_args.args[1]["$set"]


def test_startup_repairs_old_duplicates_without_moving_other_addresses():
    manifest_one, manifest_two, manifest_later = ObjectId(), ObjectId(), ObjectId()
    now = datetime.now(timezone.utc)
    shipments = [
        {"_id": ObjectId(), "manifest_id": str(manifest_one), "shipment_date": "2026-11-19", "address_number": 1, "created_at": now},
        {"_id": ObjectId(), "manifest_id": str(manifest_two), "shipment_date": "2026-11-19", "address_number": 1, "created_at": now},
        {"_id": ObjectId(), "manifest_id": str(manifest_two), "shipment_date": "2026-11-19", "address_number": 2, "created_at": now},
        {"_id": ObjectId(), "manifest_id": str(manifest_later), "shipment_date": "2026-11-20", "address_number": 1, "created_at": now},
    ]
    addresses = [
        {"number": number, "address": f"Dirección {number}", "phone": "12345678"}
        for number in (1, 2, 3)
    ]
    manifests = [
        {"_id": manifest_one, "manifest_date": "2026-11-19"},
        {"_id": manifest_two, "manifest_date": "2026-11-19"},
        {"_id": manifest_later, "manifest_date": "2026-11-20"},
    ]

    async def update(query, change):
        next(item for item in shipments if item["_id"] == query["_id"]).update(change["$set"])

    database = SimpleNamespace(
        manifests=SimpleNamespace(find=Mock(return_value=AsyncCursor(manifests))),
        addresses=SimpleNamespace(find=Mock(return_value=AsyncCursor(addresses))),
        shipments=SimpleNamespace(
            find=Mock(return_value=AsyncCursor(shipments)),
            update_one=AsyncMock(side_effect=update),
            create_index=AsyncMock(),
        ),
    )

    asyncio.run(ensure_unique_daily_addresses(database))

    assert [item["address_number"] for item in shipments] == [1, 3, 2, 1]
    assert shipments[1]["consignee_address"] == "Dirección 3"
    assert database.shipments.create_index.call_args.kwargs == {
        "unique": True,
        "name": DAILY_ADDRESS_INDEX,
        "partialFilterExpression": {"manifest_id": {"$type": "string"}},
    }
    asyncio.run(ensure_unique_daily_addresses(database))
    assert database.shipments.update_one.await_count == 1
