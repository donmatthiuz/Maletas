import asyncio
from io import BytesIO

from bson import ObjectId
from httpx import ASGITransport, AsyncClient
from openpyxl import Workbook
import pytest

from app.database import get_database
from app.main import app
from app.services.address_excel_import import (
    confirm_address_import,
    preview_address_import,
    read_address_column,
)


class AsyncCursor:
    def __init__(self, documents):
        self.documents = documents

    def __aiter__(self):
        return self._items()

    async def _items(self):
        for item in self.documents:
            yield item


class Addresses:
    def __init__(self, documents):
        self.documents = documents
        self.inserted = []

    def find(self, _query, _projection):
        return AsyncCursor(self.documents)

    async def insert_one(self, document):
        self.documents.append(document)
        self.inserted.append(document)


class Database:
    def __init__(self, documents):
        self.addresses = Addresses(documents)


def workbook_bytes():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Calle Nueva 1", "Esta columna se ignora"])
    sheet.append([" CALLE NUEVA 1 "])
    sheet.append(["CALLE SAN JOSE 12"])
    sheet.append([None])
    sheet.append(["Avenida Nueva 2"])
    workbook.create_sheet("Otra hoja").append(["No importar"])
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def test_preview_reads_first_column_from_first_row_and_marks_duplicates():
    database = Database([{
        "_id": ObjectId(), "number": 99,
        "address": "Calle San José 12", "phone": "(240) 556-3504",
    }])
    contents = workbook_bytes()

    preview = asyncio.run(preview_address_import(database, contents, "direcciones.xlsx"))

    assert [row["row"] for row in preview["rows"]] == [1, 2, 3, 5]
    assert [row["status"] for row in preview["rows"]] == ["ready", "duplicate", "duplicate", "ready"]
    assert [(row["number"], row["phone"]) for row in preview["rows"] if row["status"] == "ready"] == [
        (100, "2405563505"), (101, "2405563506")
    ]
    assert preview["ready_count"] == 2
    assert preview["duplicate_count"] == 2
    assert database.addresses.inserted == []


def test_confirm_inserts_only_previewed_rows_and_rechecks_directory():
    database = Database([{
        "_id": ObjectId(), "number": 99,
        "address": "Calle San José 12", "phone": "2405563504",
    }])
    contents = workbook_bytes()
    preview = asyncio.run(preview_address_import(database, contents, "direcciones.xlsx"))

    result = asyncio.run(confirm_address_import(database, contents, "direcciones.xlsx", preview["digest"]))

    assert result["inserted_count"] == 2
    assert result["skipped_count"] == 2
    assert [item["number"] for item in database.addresses.inserted] == [100, 101]
    assert [item["phone_key"] for item in database.addresses.inserted] == ["2405563505", "2405563506"]

    with pytest.raises(ValueError, match="vista previa nueva"):
        asyncio.run(confirm_address_import(database, contents, "direcciones.xlsx", preview["digest"]))


def test_rejects_unsupported_or_empty_excel():
    with pytest.raises(ValueError, match=".xlsx o .xlsm"):
        read_address_column(b"old spreadsheet", "direcciones.xls")
    with pytest.raises(ValueError, match="contener datos"):
        read_address_column(b"", "direcciones.xlsx")


def test_numeric_cell_is_shown_but_not_inserted():
    workbook = Workbook()
    workbook.active["A1"] = 123456
    output = BytesIO()
    workbook.save(output)
    workbook.close()

    preview = asyncio.run(preview_address_import(Database([]), output.getvalue(), "direcciones.xlsx"))

    assert preview["rows"][0]["status"] == "invalid"
    assert preview["rows"][0]["number"] is None
    assert preview["ready_count"] == 0


def test_multipart_api_previews_then_confirms_same_excel():
    database = Database([])
    contents = workbook_bytes()
    app.dependency_overrides[get_database] = lambda: database

    async def request():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            file = ("direcciones.xlsx", contents, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            preview = await client.post("/api/v1/addresses/import/preview", files={"file": file})
            assert preview.status_code == 200
            assert preview.json()["ready_count"] == 3
            confirmed = await client.post(
                "/api/v1/addresses/import/confirm",
                files={"file": file},
                data={"digest": preview.json()["digest"]},
            )
            assert confirmed.status_code == 200
            assert confirmed.json()["inserted_count"] == 3

    try:
        asyncio.run(request())
    finally:
        app.dependency_overrides.clear()
