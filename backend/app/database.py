from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_database() -> AsyncIOMotorDatabase:
    global client, database
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=5000)
    await client.admin.command("ping")
    database = client[settings.mongo_database]

    await database.addresses.create_index("number", unique=True)
    await database.addresses.create_index([("address", "text"), ("phone", "text")])
    await database.shipments.create_index("code")
    await database.manifests.create_index("legacy_date", unique=True, sparse=True)
    await database.manifests.create_index("manifest_date")
    await database.bags.create_index(
        [("manifest_id", 1), ("number", 1)], unique=True
    )
    await database.shipments.create_index([("bag_id", 1), ("print_order", 1)])
    await database.shipments.create_index("manifest_id")
    await database.shipments.create_index([("bag_number", 1), ("shipment_date", -1)])
    await database.shipments.create_index(
        [
            ("code", "text"),
            ("shipper_name", "text"),
            ("consignee_name", "text"),
            ("contents", "text"),
        ],
        name="shipment_search",
    )
    return database


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("La conexión a MongoDB no está inicializada")
    return database


async def close_database() -> None:
    global client, database
    if client is not None:
        client.close()
    client = None
    database = None
