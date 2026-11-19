"""Keep destination addresses unique across manifests sharing a date."""

from collections import defaultdict

from pymongo import ASCENDING

from app.schemas import utc_now


DAILY_ADDRESS_INDEX = "shipment_date_1_address_number_1_unique"


async def ensure_unique_daily_addresses(database) -> None:
    """Repair older duplicates before enforcing the daily unique index.

    Keep the first assignment for each date and move only later duplicates.
    This also brings old shipment dates back in sync with their manifests.
    """
    manifests = {
        str(item["_id"]): item["manifest_date"]
        async for item in database.manifests.find({}, {"manifest_date": 1})
    }
    addresses = [item async for item in database.addresses.find({})]
    addresses_by_number = {item["number"]: item for item in addresses}
    shipments = [
        item
        async for item in database.shipments.find({"manifest_id": {"$type": "string"}}).sort(
            [("created_at", ASCENDING), ("_id", ASCENDING)]
        )
    ]
    shipments_by_date: dict[str, list[dict]] = defaultdict(list)
    for shipment in shipments:
        manifest_id = shipment["manifest_id"]
        if manifest_id not in manifests:
            raise RuntimeError(f"El baucher {shipment['_id']} pertenece a un manifiesto inexistente")
        shipments_by_date[manifests[manifest_id]].append(shipment)

    for shipment_date, dated_shipments in shipments_by_date.items():
        reserved = set()
        repeated_ids = set()
        for shipment in dated_shipments:
            number = shipment["address_number"]
            if number not in addresses_by_number:
                raise RuntimeError(
                    f"La dirección n.º {number} del baucher {shipment['_id']} no existe en el directorio"
                )
            if number in reserved:
                repeated_ids.add(shipment["_id"])
            reserved.add(number)

        for shipment in dated_shipments:
            changes = {}
            if shipment["_id"] in repeated_ids:
                replacement = next(
                    (item for item in addresses if item["number"] not in reserved),
                    None,
                )
                if replacement is None:
                    raise RuntimeError(
                        f"No hay direcciones suficientes para los bauchers del {shipment_date}"
                    )
                reserved.add(replacement["number"])
                changes.update(
                    address_number=replacement["number"],
                    consignee_address=replacement["address"],
                    phone=replacement["phone"],
                )
            if shipment.get("shipment_date") != shipment_date:
                changes["shipment_date"] = shipment_date
            if changes:
                changes["updated_at"] = utc_now()
                await database.shipments.update_one({"_id": shipment["_id"]}, {"$set": changes})

    await database.shipments.create_index(
        [("shipment_date", ASCENDING), ("address_number", ASCENDING)],
        unique=True,
        name=DAILY_ADDRESS_INDEX,
        partialFilterExpression={"manifest_id": {"$type": "string"}},
    )
