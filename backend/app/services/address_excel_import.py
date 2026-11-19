"""Preview and import addresses from column A of the first Excel sheet."""

import hashlib
import io
import json
from pathlib import Path
from zipfile import BadZipFile

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from fastapi.concurrency import run_in_threadpool
from pymongo.errors import DuplicateKeyError

from app.services.address_directory import address_key, phone_key, suggested_phone


MAX_EXCEL_BYTES = 5_000_000
MAX_EXCEL_ROWS = 5_000


def read_address_column(contents: bytes, filename: str) -> list[dict]:
    if Path(filename).suffix.lower() not in {".xlsx", ".xlsm"}:
        raise ValueError("Sube un archivo Excel .xlsx o .xlsm")
    if not contents or len(contents) > MAX_EXCEL_BYTES:
        raise ValueError("El archivo debe contener datos y medir como máximo 5 MB")
    try:
        workbook = load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    except (BadZipFile, InvalidFileException, OSError, ValueError, KeyError) as exc:
        raise ValueError("No se pudo leer el archivo Excel") from exc
    try:
        sheet = workbook.worksheets[0]
        rows = []
        for row_number, (value,) in enumerate(
            sheet.iter_rows(min_col=1, max_col=1, values_only=True), start=1
        ):
            if row_number > MAX_EXCEL_ROWS:
                raise ValueError("El Excel no puede superar 5000 filas en la primera hoja")
            if value is None or not str(value).strip():
                continue
            rows.append({
                "row": row_number,
                "address": " ".join(str(value).split()),
                "text_cell": isinstance(value, str),
            })
        if not rows:
            raise ValueError("La columna A de la primera hoja está vacía")
        return rows
    finally:
        workbook.close()


async def preview_address_import(database, contents: bytes, filename: str) -> dict:
    source_rows = await run_in_threadpool(read_address_column, contents, filename)
    existing = [
        item async for item in database.addresses.find({}, {"number": 1, "address": 1, "phone": 1})
    ]
    existing_keys = {address_key(item["address"]) for item in existing}
    used_phones = {phone_key(item["phone"]) for item in existing}
    next_number = max((item["number"] for item in existing), default=0) + 1
    next_phone = suggested_phone(used_phones)
    phone_floor = 10 ** (len(next_phone) - 1)
    phone_ceiling = 10 ** len(next_phone)
    seen_file = {}
    rows = []

    for source in source_rows:
        row = {"row": source["row"], "address": source["address"], "number": None, "phone": None}
        key = address_key(source["address"])
        if not source["text_cell"] or not 5 <= len(source["address"]) <= 240:
            row.update(status="invalid", reason="Debe ser una dirección de texto de 5 a 240 caracteres. No se insertará.")
        elif key in existing_keys:
            row.update(status="duplicate", reason="Ya existe en el directorio. No se insertará.")
        elif key in seen_file:
            row.update(status="duplicate", reason=f"Repetida en la fila {seen_file[key]}. No se insertará.")
        else:
            row.update(status="ready", reason="Se insertará.", number=next_number, phone=next_phone)
            next_number += 1
            used_phones.add(next_phone)
            candidate = int(next_phone) + 1
            if candidate >= phone_ceiling:
                candidate = phone_floor
            while str(candidate) in used_phones:
                candidate += 1
                if candidate >= phone_ceiling:
                    candidate = phone_floor
            next_phone = str(candidate)
            seen_file[key] = source["row"]
        rows.append(row)

    preview = {
        "filename": filename,
        "rows": rows,
        "ready_count": sum(row["status"] == "ready" for row in rows),
        "duplicate_count": sum(row["status"] == "duplicate" for row in rows),
        "invalid_count": sum(row["status"] == "invalid" for row in rows),
    }
    digest_source = json.dumps(
        {"file": hashlib.sha256(contents).hexdigest(), "rows": rows},
        ensure_ascii=False, sort_keys=True,
    ).encode("utf-8")
    preview["digest"] = hashlib.sha256(digest_source).hexdigest()
    return preview


async def confirm_address_import(database, contents: bytes, filename: str, digest: str) -> dict:
    preview = await preview_address_import(database, contents, filename)
    if preview["digest"] != digest:
        raise ValueError("El directorio o el archivo cambió. Genera una vista previa nueva antes de importar.")

    inserted_count = 0
    results = []
    for row in preview["rows"]:
        if row["status"] != "ready":
            results.append({"row": row["row"], "status": "skipped", "reason": row["reason"]})
            continue
        document = {
            "number": row["number"],
            "address": row["address"],
            "phone": row["phone"],
            "address_key": address_key(row["address"]),
            "phone_key": phone_key(row["phone"]),
        }
        try:
            await database.addresses.insert_one(document)
        except DuplicateKeyError:
            results.append({
                "row": row["row"], "status": "skipped",
                "reason": "Otro registro ocupó este número, teléfono o dirección. No se insertó.",
            })
        else:
            inserted_count += 1
            results.append({"row": row["row"], "status": "inserted"})
    return {
        "inserted_count": inserted_count,
        "skipped_count": len(results) - inserted_count,
        "results": results,
    }
