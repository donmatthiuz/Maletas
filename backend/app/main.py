import csv
import io
import math
import re
from contextlib import asynccontextmanager
from datetime import date

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, UpdateOne
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.database import close_database, connect_database, get_database
from app.schemas import (
    AddressCreate,
    AddressResponse,
    BagCreate,
    BagResponse,
    BagUpdate,
    DashboardStats,
    HealthResponse,
    ManifestCreate,
    ManifestResponse,
    ManifestUpdate,
    ShipmentCreate,
    ShipmentList,
    ShipmentResponse,
    ShipmentReorder,
    ShipmentUpdate,
    TranslateRequest,
    TranslateResponse,
    utc_now,
)
from app.services.importer import seed_database
from app.services.hierarchy import ensure_hierarchy
from app.services.translator import translate_contents


settings = get_settings()


def serialize(document: dict) -> dict:
    item = dict(document)
    item["id"] = str(item.pop("_id"))
    return item


def object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return ObjectId(value)


async def resolve_address(database: AsyncIOMotorDatabase, number: int) -> dict:
    address = await database.addresses.find_one({"number": number})
    if not address:
        raise HTTPException(
            status_code=422, detail=f"La dirección n.º {number} no existe en el directorio"
        )
    return address


async def resolve_random_address(
    database: AsyncIOMotorDatabase, manifest_id: str
) -> dict:
    used_numbers = await database.shipments.distinct(
        "address_number", {"manifest_id": manifest_id}
    )
    pipeline = [
        {"$match": {"number": {"$nin": [number for number in used_numbers if number]}}},
        {"$sample": {"size": 1}},
    ]
    address = None
    async for candidate in database.addresses.aggregate(pipeline):
        address = candidate
        break
    if not address:
        raise HTTPException(
            status_code=409,
            detail="No quedan direcciones sin usar en este manifiesto. Registra más direcciones para continuar.",
        )
    return address


async def resolve_bag(database: AsyncIOMotorDatabase, bag_id: str) -> tuple[dict, dict]:
    bag = await database.bags.find_one({"_id": object_id(bag_id)})
    if not bag:
        raise HTTPException(status_code=422, detail="La maleta seleccionada no existe")
    manifest = await database.manifests.find_one({"_id": object_id(bag["manifest_id"])})
    if not manifest:
        raise HTTPException(status_code=422, detail="El manifiesto de la maleta no existe")
    return bag, manifest


@asynccontextmanager
async def lifespan(_: FastAPI):
    database = await connect_database()
    if settings.seed_from_workbook:
        await seed_database(database, settings.source_workbook)
    await ensure_hierarchy(database)
    yield
    await close_database()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API para registrar maletas, generar manifiestos y administrar destinatarios.",
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(f"{settings.api_prefix}/health", response_model=HealthResponse, tags=["Sistema"])
async def health(database: AsyncIOMotorDatabase = Depends(get_database)):
    await database.command("ping")
    return {
        "status": "ok",
        "database": "connected",
        "environment": settings.app_env,
    }


@app.get(f"{settings.api_prefix}/stats", response_model=DashboardStats, tags=["Tablero"])
async def dashboard_stats(database: AsyncIOMotorDatabase = Depends(get_database)):
    status_counts = {
        item["_id"]: item["count"]
        async for item in database.shipments.aggregate(
            [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        )
    }
    by_bag = [
        {"bag_number": item["_id"], "count": item["count"]}
        async for item in database.shipments.aggregate(
            [
                {"$group": {"_id": "$bag_number", "count": {"$sum": 1}}},
                {"$sort": {"_id": 1}},
            ]
        )
    ]
    return {
        "total_shipments": await database.shipments.count_documents({}),
        "active_bags": len(by_bag),
        "registered": status_counts.get("registrado", 0),
        "in_transit": status_counts.get("en_transito", 0),
        "delivered": status_counts.get("entregado", 0),
        "total_addresses": await database.addresses.count_documents({}),
        "shipments_by_bag": by_bag,
    }


def shipment_filter(
    search: str | None,
    bag_number: int | None,
    shipment_status: str | None,
    manifest_id: str | None = None,
    bag_id: str | None = None,
) -> dict:
    filters: dict = {}
    if search:
        safe = re.escape(search.strip())
        filters["$or"] = [
            {field: {"$regex": safe, "$options": "i"}}
            for field in ("code", "shipper_name", "consignee_name", "contents")
        ]
    if bag_number is not None:
        filters["bag_number"] = bag_number
    if shipment_status:
        filters["status"] = shipment_status
    if manifest_id:
        filters["manifest_id"] = manifest_id
    if bag_id:
        filters["bag_id"] = bag_id
    return filters


@app.get(f"{settings.api_prefix}/shipments/export.csv", tags=["Envíos"])
async def export_shipments(
    search: str | None = None,
    bag_number: int | None = Query(default=None, ge=1),
    shipment_status: str | None = Query(default=None, alias="status"),
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Código",
            "Maleta",
            "Envía",
            "Dirección envía",
            "Recibe",
            "Dirección recibe",
            "Teléfono",
            "Contenido",
            "Encargado",
            "Fecha",
            "Estado",
        ]
    )
    query = shipment_filter(search, bag_number, shipment_status)
    async for item in database.shipments.find(query).sort("created_at", DESCENDING):
        writer.writerow(
            [
                item["code"],
                item["bag_number"],
                item["shipper_name"],
                item["shipper_address"],
                item["consignee_name"],
                item["consignee_address"],
                item["phone"],
                item["contents"],
                item["attendant"],
                item["shipment_date"],
                item["status"],
            ]
        )
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=envios-maletas.csv"},
    )


@app.get(f"{settings.api_prefix}/shipments", response_model=ShipmentList, tags=["Envíos"])
async def list_shipments(
    search: str | None = None,
    bag_number: int | None = Query(default=None, ge=1),
    shipment_status: str | None = Query(default=None, alias="status"),
    manifest_id: str | None = None,
    bag_id: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=100),
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    query = shipment_filter(search, bag_number, shipment_status, manifest_id, bag_id)
    total = await database.shipments.count_documents(query)
    cursor = (
        database.shipments.find(query)
        .sort([("shipment_date", DESCENDING), ("created_at", DESCENDING)])
        .skip((page - 1) * limit)
        .limit(limit)
    )
    items = [serialize(document) async for document in cursor]
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, math.ceil(total / limit)),
    }


@app.post(
    f"{settings.api_prefix}/shipments",
    response_model=ShipmentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Envíos"],
)
async def create_shipment(
    payload: ShipmentCreate, database: AsyncIOMotorDatabase = Depends(get_database)
):
    document = payload.model_dump(exclude={"translate_contents"}, mode="json")
    bag = None
    manifest = None
    if payload.bag_id:
        bag, manifest = await resolve_bag(database, payload.bag_id)
        document.update(
            {
                "bag_id": str(bag["_id"]),
                "manifest_id": str(manifest["_id"]),
                "bag_number": bag["number"],
                "shipment_date": manifest["manifest_date"],
                "attendant": bag["attendant"],
            }
        )
    if manifest:
        address = await resolve_random_address(database, str(manifest["_id"]))
    elif payload.address_number:
        address = await resolve_address(database, payload.address_number)
    else:
        raise HTTPException(status_code=422, detail="El baucher debe pertenecer a una maleta")

    if bag:
        last = await database.shipments.find_one(
            {"bag_id": str(bag["_id"])}, sort=[("print_order", DESCENDING)]
        )
        document["print_order"] = int(last.get("print_order", 0) if last else 0) + 1
    if payload.translate_contents:
        document["contents"] = await run_in_threadpool(translate_contents, payload.contents)
    document.update(
        {
            "consignee_address": address["address"],
            "address_number": address["number"],
            "phone": address["phone"],
            "customs_type": "UNSOLICITED",
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
    )
    result = await database.shipments.insert_one(document)
    return serialize(await database.shipments.find_one({"_id": result.inserted_id}))


@app.get(
    f"{settings.api_prefix}/shipments/{{shipment_id}}",
    response_model=ShipmentResponse,
    tags=["Envíos"],
)
async def get_shipment(
    shipment_id: str, database: AsyncIOMotorDatabase = Depends(get_database)
):
    document = await database.shipments.find_one({"_id": object_id(shipment_id)})
    if not document:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    return serialize(document)


@app.patch(
    f"{settings.api_prefix}/shipments/{{shipment_id}}",
    response_model=ShipmentResponse,
    tags=["Envíos"],
)
async def update_shipment(
    shipment_id: str,
    payload: ShipmentUpdate,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    shipment_oid = object_id(shipment_id)
    current = await database.shipments.find_one({"_id": shipment_oid})
    if not current:
        raise HTTPException(status_code=404, detail="Envío no encontrado")

    changes = payload.model_dump(
        exclude_unset=True,
        exclude={"translate_contents", "address_number"},
        mode="json",
    )
    if payload.bag_id:
        bag, manifest = await resolve_bag(database, payload.bag_id)
        moving_manifest = str(manifest["_id"]) != current.get("manifest_id")
        changes.update(
            {
                "bag_id": str(bag["_id"]),
                "manifest_id": str(manifest["_id"]),
                "bag_number": bag["number"],
                "shipment_date": manifest["manifest_date"],
                "attendant": bag["attendant"],
            }
        )
        if moving_manifest:
            address = await resolve_random_address(database, str(manifest["_id"]))
            changes.update(
                {
                    "address_number": address["number"],
                    "consignee_address": address["address"],
                    "phone": address["phone"],
                }
            )
    if payload.translate_contents and "contents" in changes:
        changes["contents"] = await run_in_threadpool(translate_contents, changes["contents"])
    changes["updated_at"] = utc_now()
    await database.shipments.update_one({"_id": shipment_oid}, {"$set": changes})
    return serialize(await database.shipments.find_one({"_id": shipment_oid}))


@app.delete(
    f"{settings.api_prefix}/shipments/{{shipment_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Envíos"],
)
async def delete_shipment(
    shipment_id: str, database: AsyncIOMotorDatabase = Depends(get_database)
):
    result = await database.shipments.delete_one({"_id": object_id(shipment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Envío no encontrado")


@app.get(f"{settings.api_prefix}/addresses", response_model=list[AddressResponse], tags=["Directorio"])
async def list_addresses(
    search: str | None = None,
    limit: int = Query(default=150, ge=1, le=500),
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    query: dict = {}
    if search:
        safe = re.escape(search.strip())
        query = {
            "$or": [
                {"address": {"$regex": safe, "$options": "i"}},
                {"phone": {"$regex": safe, "$options": "i"}},
            ]
        }
        if search.strip().isdigit():
            query["$or"].append({"number": int(search.strip())})
    cursor = database.addresses.find(query).sort("number", ASCENDING).limit(limit)
    return [serialize(document) async for document in cursor]


@app.post(
    f"{settings.api_prefix}/addresses",
    response_model=AddressResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Directorio"],
)
async def create_address(
    payload: AddressCreate, database: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        result = await database.addresses.insert_one(payload.model_dump())
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409, detail=f"Ya existe la dirección n.º {payload.number}"
        ) from exc
    return serialize(await database.addresses.find_one({"_id": result.inserted_id}))


@app.patch(
    f"{settings.api_prefix}/addresses/{{address_id}}",
    response_model=AddressResponse,
    tags=["Directorio"],
)
async def update_address(
    address_id: str,
    payload: AddressCreate,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    address_oid = object_id(address_id)
    current = await database.addresses.find_one({"_id": address_oid})
    if not current:
        raise HTTPException(status_code=404, detail="Dirección no encontrada")
    try:
        await database.addresses.update_one({"_id": address_oid}, {"$set": payload.model_dump()})
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Ese número ya está en uso") from exc

    await database.shipments.update_many(
        {"address_number": current["number"]},
        {
            "$set": {
                "address_number": payload.number,
                "consignee_address": payload.address,
                "phone": payload.phone,
                "updated_at": utc_now(),
            }
        },
    )
    return serialize(await database.addresses.find_one({"_id": address_oid}))


@app.get(
    f"{settings.api_prefix}/manifests",
    response_model=list[ManifestResponse],
    tags=["Manifiestos"],
)
async def list_manifests(
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    results = []
    async for document in database.manifests.find({}).sort(
        [("manifest_date", DESCENDING), ("created_at", DESCENDING)]
    ):
        manifest_id = str(document["_id"])
        item = serialize(document)
        item["bag_count"] = await database.bags.count_documents(
            {"manifest_id": manifest_id}
        )
        item["voucher_count"] = await database.shipments.count_documents(
            {"manifest_id": manifest_id}
        )
        results.append(item)
    return results


@app.post(
    f"{settings.api_prefix}/manifests",
    response_model=ManifestResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Manifiestos"],
)
async def create_manifest(
    payload: ManifestCreate,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    now = utc_now()
    document = {
        **payload.model_dump(mode="json"),
        "created_at": now,
        "updated_at": now,
    }
    result = await database.manifests.insert_one(document)
    return {**serialize(await database.manifests.find_one({"_id": result.inserted_id})), "bag_count": 0, "voucher_count": 0}


@app.patch(
    f"{settings.api_prefix}/manifests/{{manifest_id}}",
    response_model=ManifestResponse,
    tags=["Manifiestos"],
)
async def update_manifest(
    manifest_id: str,
    payload: ManifestUpdate,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    manifest_oid = object_id(manifest_id)
    current = await database.manifests.find_one({"_id": manifest_oid})
    if not current:
        raise HTTPException(status_code=404, detail="Manifiesto no encontrado")

    changes = payload.model_dump(exclude_unset=True, mode="json")
    if not changes:
        raise HTTPException(status_code=422, detail="No se enviaron cambios para el manifiesto")
    changes["updated_at"] = utc_now()
    await database.manifests.update_one({"_id": manifest_oid}, {"$set": changes})

    if "manifest_date" in changes:
        await database.shipments.update_many(
            {"manifest_id": manifest_id},
            {"$set": {"shipment_date": changes["manifest_date"], "updated_at": utc_now()}},
        )

    updated = serialize(await database.manifests.find_one({"_id": manifest_oid}))
    updated["bag_count"] = await database.bags.count_documents(
        {"manifest_id": manifest_id}
    )
    updated["voucher_count"] = await database.shipments.count_documents(
        {"manifest_id": manifest_id}
    )
    return updated


@app.get(
    f"{settings.api_prefix}/manifests/{{manifest_id}}/bags",
    response_model=list[BagResponse],
    tags=["Maletas"],
)
async def list_bags(
    manifest_id: str,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    if not await database.manifests.find_one({"_id": object_id(manifest_id)}):
        raise HTTPException(status_code=404, detail="Manifiesto no encontrado")
    results = []
    async for document in database.bags.find({"manifest_id": manifest_id}).sort("number", ASCENDING):
        item = serialize(document)
        item["voucher_count"] = await database.shipments.count_documents(
            {"bag_id": item["id"]}
        )
        results.append(item)
    return results


@app.post(
    f"{settings.api_prefix}/manifests/{{manifest_id}}/bags",
    response_model=BagResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Maletas"],
)
async def create_bag(
    manifest_id: str,
    payload: BagCreate,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    if not await database.manifests.find_one({"_id": object_id(manifest_id)}):
        raise HTTPException(status_code=404, detail="Manifiesto no encontrado")
    now = utc_now()
    document = {
        **payload.model_dump(),
        "name": payload.name or f"Maleta #{payload.number}",
        "manifest_id": manifest_id,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await database.bags.insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail=f"El manifiesto ya contiene la maleta #{payload.number}",
        ) from exc
    return {**serialize(await database.bags.find_one({"_id": result.inserted_id})), "voucher_count": 0}


@app.patch(
    f"{settings.api_prefix}/bags/{{bag_id}}",
    response_model=BagResponse,
    tags=["Maletas"],
)
async def update_bag(
    bag_id: str,
    payload: BagUpdate,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    bag_oid = object_id(bag_id)
    current = await database.bags.find_one({"_id": bag_oid})
    if not current:
        raise HTTPException(status_code=404, detail="Maleta no encontrada")

    changes = payload.model_dump(exclude_unset=True)
    next_number = changes.get("number", current["number"])
    if "name" in changes and not changes["name"]:
        changes["name"] = f"Maleta #{next_number}"
    if not changes:
        raise HTTPException(status_code=422, detail="No se enviaron cambios para la maleta")
    changes["updated_at"] = utc_now()

    try:
        await database.bags.update_one({"_id": bag_oid}, {"$set": changes})
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail=f"El manifiesto ya contiene la maleta #{next_number}",
        ) from exc

    shipment_changes = {"updated_at": utc_now()}
    if "number" in changes:
        shipment_changes["bag_number"] = changes["number"]
    if "attendant" in changes:
        shipment_changes["attendant"] = changes["attendant"]
    if len(shipment_changes) > 1:
        await database.shipments.update_many(
            {"bag_id": bag_id}, {"$set": shipment_changes}
        )

    updated = serialize(await database.bags.find_one({"_id": bag_oid}))
    updated["voucher_count"] = await database.shipments.count_documents(
        {"bag_id": bag_id}
    )
    return updated


@app.get(
    f"{settings.api_prefix}/bags/{{bag_id}}/shipments",
    response_model=list[ShipmentResponse],
    tags=["Maletas"],
)
async def list_bag_shipments(
    bag_id: str,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    await resolve_bag(database, bag_id)
    cursor = database.shipments.find({"bag_id": bag_id}).sort(
        [("print_order", ASCENDING), ("created_at", ASCENDING)]
    )
    return [serialize(document) async for document in cursor]


@app.put(
    f"{settings.api_prefix}/bags/{{bag_id}}/shipments/order",
    response_model=list[ShipmentResponse],
    tags=["Maletas"],
)
async def reorder_bag_shipments(
    bag_id: str,
    payload: ShipmentReorder,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    await resolve_bag(database, bag_id)
    current_ids = {
        str(document["_id"])
        async for document in database.shipments.find({"bag_id": bag_id}, {"_id": 1})
    }
    if set(payload.shipment_ids) != current_ids:
        raise HTTPException(
            status_code=422,
            detail="El orden debe incluir exactamente todos los bauchers de la maleta",
        )
    operations = [
        UpdateOne(
            {"_id": object_id(shipment_id), "bag_id": bag_id},
            {"$set": {"print_order": position, "updated_at": utc_now()}},
        )
        for position, shipment_id in enumerate(payload.shipment_ids, start=1)
    ]
    if operations:
        await database.shipments.bulk_write(operations)
    cursor = database.shipments.find({"bag_id": bag_id}).sort("print_order", ASCENDING)
    return [serialize(document) async for document in cursor]


@app.post(f"{settings.api_prefix}/translate", response_model=TranslateResponse, tags=["Herramientas"])
async def translate(payload: TranslateRequest):
    translated = await run_in_threadpool(translate_contents, payload.text)
    return {"original": payload.text, "translated": translated}
