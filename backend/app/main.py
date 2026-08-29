import csv
import io
import math
import re
from contextlib import asynccontextmanager
from datetime import date

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.database import close_database, connect_database, get_database
from app.schemas import (
    AddressCreate,
    AddressResponse,
    DashboardStats,
    HealthResponse,
    ShipmentCreate,
    ShipmentList,
    ShipmentResponse,
    ShipmentUpdate,
    TranslateRequest,
    TranslateResponse,
    utc_now,
)
from app.services.importer import seed_database
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    database = await connect_database()
    if settings.seed_from_workbook:
        await seed_database(database, settings.source_workbook)
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
    return {"status": "ok", "database": "connected"}


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


def shipment_filter(search: str | None, bag_number: int | None, shipment_status: str | None) -> dict:
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
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=100),
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    query = shipment_filter(search, bag_number, shipment_status)
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
    address = await resolve_address(database, payload.address_number)
    document = payload.model_dump(exclude={"translate_contents"}, mode="json")
    if payload.translate_contents:
        document["contents"] = translate_contents(payload.contents)
    document.update(
        {
            "consignee_address": address["address"],
            "phone": address["phone"],
            "customs_type": "UNSOLICITED",
            "quantity": 2,
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

    changes = payload.model_dump(exclude_unset=True, exclude={"translate_contents"}, mode="json")
    address_number = changes.get("address_number")
    if address_number is not None:
        address = await resolve_address(database, address_number)
        changes.update({"consignee_address": address["address"], "phone": address["phone"]})
    if payload.translate_contents and "contents" in changes:
        changes["contents"] = translate_contents(changes["contents"])
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


@app.get(f"{settings.api_prefix}/manifests", response_model=list[ShipmentResponse], tags=["Manifiestos"])
async def get_manifest(
    bag_number: int = Query(ge=1),
    shipment_date: date | None = None,
    database: AsyncIOMotorDatabase = Depends(get_database),
):
    query: dict = {"bag_number": bag_number}
    if shipment_date:
        query["shipment_date"] = shipment_date.isoformat()
    cursor = database.shipments.find(query).sort("created_at", ASCENDING)
    return [serialize(document) async for document in cursor]


@app.post(f"{settings.api_prefix}/translate", response_model=TranslateResponse, tags=["Herramientas"])
async def translate(payload: TranslateRequest):
    return {"original": payload.text, "translated": translate_contents(payload.text)}
