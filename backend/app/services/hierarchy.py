from datetime import date

from pymongo.errors import DuplicateKeyError

from app.schemas import utc_now


async def ensure_hierarchy(database) -> None:
    """Backfill the workbook-era shipments into manifest and bag records."""
    cursor = database.shipments.find(
        {
            "$or": [
                {"manifest_id": {"$exists": False}},
                {"manifest_id": None},
                {"bag_id": {"$exists": False}},
                {"bag_id": None},
            ]
        }
    ).sort([("shipment_date", 1), ("bag_number", 1), ("created_at", 1)])

    async for shipment in cursor:
        shipment_date = str(shipment.get("shipment_date") or date.today().isoformat())
        manifest = await database.manifests.find_one({"legacy_date": shipment_date})
        if not manifest:
            now = utc_now()
            manifest_document = {
                "name": f"Manifiesto {shipment_date}",
                "manifest_date": shipment_date,
                "attendant": shipment.get("attendant") or "DORIAN SANTIZO",
                "legacy_date": shipment_date,
                "created_at": now,
                "updated_at": now,
            }
            try:
                result = await database.manifests.insert_one(manifest_document)
                manifest = {**manifest_document, "_id": result.inserted_id}
            except DuplicateKeyError:
                manifest = await database.manifests.find_one({"legacy_date": shipment_date})

        manifest_id = str(manifest["_id"])
        bag_number = int(shipment.get("bag_number") or 1)
        bag = await database.bags.find_one(
            {"manifest_id": manifest_id, "number": bag_number}
        )
        if not bag:
            now = utc_now()
            bag_document = {
                "manifest_id": manifest_id,
                "number": bag_number,
                "name": f"Maleta #{bag_number}",
                "created_at": now,
                "updated_at": now,
            }
            try:
                result = await database.bags.insert_one(bag_document)
                bag = {**bag_document, "_id": result.inserted_id}
            except DuplicateKeyError:
                bag = await database.bags.find_one(
                    {"manifest_id": manifest_id, "number": bag_number}
                )

        await database.shipments.update_one(
            {"_id": shipment["_id"]},
            {"$set": {"manifest_id": manifest_id, "bag_id": str(bag["_id"]) }},
        )
