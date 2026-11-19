"""Normalize directory entries for duplicate checks and suggestions."""

from collections import Counter
import unicodedata


def address_key(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(char for char in folded if not unicodedata.combining(char))
    return " ".join(without_accents.split())


def phone_key(value: str) -> str:
    return "".join(char for char in value if char.isdecimal())


def suggested_phone(phones: set[str]) -> str:
    lengths = Counter(len(phone) for phone in phones if 7 <= len(phone) <= 15)
    width = max(lengths, key=lambda length: (lengths[length], length == 10, length)) if lengths else 10
    floor = 10 ** (width - 1)
    ceiling = 10 ** width
    same_width = [int(phone) for phone in phones if len(phone) == width]
    candidate = max(same_width, default=floor - 1) + 1
    if candidate >= ceiling:
        candidate = floor
    while str(candidate) in phones:
        candidate += 1
        if candidate >= ceiling:
            candidate = floor
    return str(candidate)


async def check_directory_entry(database, number=None, address=None, phone=None, exclude_id=None) -> dict:
    documents = [item async for item in database.addresses.find({}, {"number": 1, "address": 1, "phone": 1})]
    compared_address = address_key(address or "")
    compared_phone = phone_key(phone or "")
    other_documents = [item for item in documents if item["_id"] != exclude_id]
    return {
        "duplicate_number": number is not None and any(item["number"] == number for item in other_documents),
        "duplicate_address": bool(compared_address) and any(
            address_key(item["address"]) == compared_address for item in other_documents
        ),
        "duplicate_phone": bool(compared_phone) and any(
            phone_key(item["phone"]) == compared_phone for item in other_documents
        ),
        "suggested_number": max((item["number"] for item in documents), default=0) + 1,
        "suggested_phone": suggested_phone({phone_key(item["phone"]) for item in documents}),
    }


def duplicate_detail(check: dict) -> str:
    names = [
        label for field, label in (
            ("duplicate_number", "número"),
            ("duplicate_phone", "teléfono"),
            ("duplicate_address", "dirección"),
        ) if check[field]
    ]
    return "Ya hay datos repetidos en el directorio: " + ", ".join(names) + "."
