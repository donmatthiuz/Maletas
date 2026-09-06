import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

from bson import ObjectId

from app.main import arrange_manifest_shipments
from app.schemas import ManifestShipmentArrange


class AsyncCursor:
    def __init__(self, documents):
        self.documents = list(documents)
        self.index = 0

    def sort(self, fields):
        sort_fields = fields if isinstance(fields, list) else [(fields, 1)]
        for field, direction in reversed(sort_fields):
            self.documents.sort(key=lambda item: item.get(field), reverse=direction < 0)
        return self

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.index >= len(self.documents):
            raise StopAsyncIteration
        document = self.documents[self.index]
        self.index += 1
        return document


class BagCollection:
    def __init__(self, documents):
        self.documents = documents

    def find(self, query):
        allowed_ids = set(query["_id"]["$in"])
        return AsyncCursor(
            item for item in self.documents
            if item["_id"] in allowed_ids and item["manifest_id"] == query["manifest_id"]
        )


class ShipmentCollection:
    def __init__(self, documents):
        self.documents = documents

    def find(self, query, projection=None):
        bag_filter = query.get("bag_id")
        if isinstance(bag_filter, dict):
            bag_ids = set(bag_filter["$in"])
            matches = [item for item in self.documents if item["bag_id"] in bag_ids]
        else:
            matches = [item for item in self.documents if item["bag_id"] == bag_filter]
        if projection:
            matches = [{"_id": item["_id"]} for item in matches]
        return AsyncCursor(matches)

    async def bulk_write(self, operations):
        for operation in operations:
            shipment = next(item for item in self.documents if item["_id"] == operation._filter["_id"])
            shipment.update(operation._doc["$set"])


def test_arrange_manifest_shipments_moves_and_orders_between_bags():
    manifest_id = str(ObjectId())
    source_id = str(ObjectId())
    target_id = str(ObjectId())
    first_id = ObjectId()
    moved_id = ObjectId()
    now = datetime.now(timezone.utc)
    bags = [
        {"_id": ObjectId(source_id), "manifest_id": manifest_id, "number": 1, "attendant": "Origen"},
        {"_id": ObjectId(target_id), "manifest_id": manifest_id, "number": 2, "attendant": "Destino"},
    ]
    shipments = [
        {"_id": moved_id, "bag_id": source_id, "code": "MOV-1", "print_order": 1, "created_at": now},
        {"_id": first_id, "bag_id": target_id, "code": "DEST-1", "print_order": 1, "created_at": now},
    ]
    database = SimpleNamespace(
        manifests=SimpleNamespace(find_one=lambda _: async_value({"_id": ObjectId(manifest_id)})),
        bags=BagCollection(bags),
        shipments=ShipmentCollection(shipments),
    )
    payload = ManifestShipmentArrange(
        bags=[
            {"bag_id": source_id, "shipment_ids": []},
            {"bag_id": target_id, "shipment_ids": [str(moved_id), str(first_id)]},
        ]
    )

    result = asyncio.run(arrange_manifest_shipments(manifest_id, payload, database))

    assert result[source_id] == []
    assert [item["id"] for item in result[target_id]] == [str(moved_id), str(first_id)]
    moved = next(item for item in shipments if item["_id"] == moved_id)
    assert moved["bag_id"] == target_id
    assert moved["bag_number"] == 2
    assert moved["attendant"] == "Destino"
    assert moved["print_order"] == 1


async def async_value(value):
    return value
