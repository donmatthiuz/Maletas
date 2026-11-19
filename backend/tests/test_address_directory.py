import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from bson import ObjectId
from fastapi import HTTPException
import pytest

from app.main import create_address
from app.schemas import AddressCreate
from app.services.address_directory import check_directory_entry


class AsyncCursor:
    def __init__(self, documents):
        self.documents = documents

    def __aiter__(self):
        return self._items()

    async def _items(self):
        for item in self.documents:
            yield item


def directory_with_one_entry():
    existing = {
        "_id": ObjectId(),
        "number": 99,
        "address": "Calle San José 12",
        "phone": "(240) 556-3504",
    }
    collection = SimpleNamespace(
        find=Mock(return_value=AsyncCursor([existing])),
        insert_one=AsyncMock(),
    )
    return SimpleNamespace(addresses=collection), existing


def test_check_normalizes_address_and_phone_and_suggests_unused_values():
    database, existing = directory_with_one_entry()

    result = asyncio.run(check_directory_entry(
        database, 99, "  CALLE   SAN JOSE 12  ", "240.556.3504"
    ))

    assert result["duplicate_number"] is True
    assert result["duplicate_address"] is True
    assert result["duplicate_phone"] is True
    assert result["suggested_number"] == 100
    assert result["suggested_phone"] == "2405563505"
    assert len(result["suggested_phone"]) == 10

    own = asyncio.run(check_directory_entry(
        database, 99, existing["address"], existing["phone"], existing["_id"]
    ))
    assert not any(own[key] for key in ("duplicate_number", "duplicate_address", "duplicate_phone"))


def test_create_rejects_normalized_duplicates_before_insert():
    database, _ = directory_with_one_entry()
    payload = AddressCreate(
        number=100,
        address="CALLE SAN JOSE 12",
        phone="2405563505",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(create_address(payload, database))

    assert error.value.status_code == 409
    assert "dirección" in error.value.detail
    database.addresses.insert_one.assert_not_awaited()


def test_create_stores_normalized_keys_for_concurrent_duplicate_protection():
    inserted_id = ObjectId()
    stored = {}

    async def insert(document):
        stored.update(document)
        return SimpleNamespace(inserted_id=inserted_id)

    database = SimpleNamespace(addresses=SimpleNamespace(
        find=Mock(return_value=AsyncCursor([])),
        insert_one=AsyncMock(side_effect=insert),
        find_one=AsyncMock(side_effect=lambda _query: {"_id": inserted_id, **stored}),
    ))

    result = asyncio.run(create_address(AddressCreate(
        number=100, address="Calle San José 12", phone="(240) 556-3504"
    ), database))

    assert stored["address_key"] == "calle san jose 12"
    assert stored["phone_key"] == "2405563504"
    assert result["number"] == 100


def test_new_phone_must_contain_digits():
    with pytest.raises(ValueError):
        AddressCreate(number=100, address="Otra dirección", phone="SIN DATO")
