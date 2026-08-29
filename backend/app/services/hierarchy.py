from datetime import date

from bson import ObjectId
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
                "attendant": shipment.get("attendant") or "DORIAN SANTIZO",
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
            {"$set": {"manifest_id": manifest_id, "bag_id": str(bag["_id"])}},
        )

    async for bag in database.bags.find({}):
        bag_id = str(bag["_id"])
        bag_attendant = bag.get("attendant")
        if not bag.get("attendant"):
            first_shipment = await database.shipments.find_one(
                {"bag_id": bag_id}, sort=[("print_order", 1), ("created_at", 1)]
            )
            manifest = await database.manifests.find_one(
                {"_id": ObjectId(bag["manifest_id"])}
            )
            bag_attendant = (
                (first_shipment or {}).get("attendant")
                or (manifest or {}).get("attendant")
                or "DORIAN SANTIZO"
            )
            await database.bags.update_one(
                {"_id": bag["_id"]},
                {"$set": {"attendant": bag_attendant, "updated_at": utc_now()}},
            )

        await database.shipments.update_many(
            {"bag_id": bag_id, "attendant": {"$ne": bag_attendant}},
            {"$set": {"attendant": bag_attendant, "updated_at": utc_now()}},
        )

        highest = await database.shipments.find_one(
            {"bag_id": bag_id, "print_order": {"$exists": True}},
            sort=[("print_order", -1)],
        )
        next_order = int(highest.get("print_order", 0) if highest else 0) + 1
        missing = database.shipments.find(
            {"bag_id": bag_id, "print_order": {"$exists": False}}
        ).sort("created_at", 1)
        async for shipment in missing:
            await database.shipments.update_one(
                {"_id": shipment["_id"]}, {"$set": {"print_order": next_order}}
            )
            next_order += 1
