from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator


ShipmentStatus = Literal["registrado", "en_transito", "entregado"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AddressBase(BaseModel):
    number: int = Field(ge=1)
    address: str = Field(min_length=5, max_length=240)
    phone: str = Field(min_length=7, max_length=24)

    @field_validator("address", "phone")
    @classmethod
    def strip_value(cls, value: str) -> str:
        return value.strip()


class AddressCreate(AddressBase):
    pass


class AddressResponse(AddressBase):
    id: str


class ManifestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    manifest_date: date = Field(default_factory=date.today)
    attendant: str = Field(min_length=2, max_length=120, default="DORIAN SANTIZO")

    @field_validator("name", "attendant")
    @classmethod
    def normalize_manifest_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class ManifestResponse(ManifestCreate):
    id: str
    bag_count: int = 0
    voucher_count: int = 0
    created_at: datetime
    updated_at: datetime


class BagCreate(BaseModel):
    number: int = Field(ge=1, le=999)
    name: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def normalize_bag_name(cls, value: str | None) -> str | None:
        return " ".join(value.strip().split()) if value else None


class BagResponse(BagCreate):
    id: str
    manifest_id: str
    voucher_count: int = 0
    created_at: datetime
    updated_at: datetime


class ShipmentBase(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    bag_number: int = Field(ge=1, le=999)
    manifest_id: str | None = None
    bag_id: str | None = None
    shipper_name: str = Field(min_length=2, max_length=120)
    shipper_address: str = Field(min_length=3, max_length=240)
    consignee_name: str = Field(min_length=2, max_length=120)
    address_number: int | None = Field(default=None, ge=1)
    contents: str = Field(min_length=2, max_length=500)
    attendant: str = Field(min_length=2, max_length=120)
    shipment_date: date = Field(default_factory=date.today)
    status: ShipmentStatus = "registrado"

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return "".join(value.upper().split())

    @field_validator(
        "shipper_name", "shipper_address", "consignee_name", "contents", "attendant"
    )
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.strip().split())


class ShipmentCreate(ShipmentBase):
    translate_contents: bool = False


class ShipmentUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=32)
    bag_number: int | None = Field(default=None, ge=1, le=999)
    manifest_id: str | None = None
    bag_id: str | None = None
    shipper_name: str | None = Field(default=None, min_length=2, max_length=120)
    shipper_address: str | None = Field(default=None, min_length=3, max_length=240)
    consignee_name: str | None = Field(default=None, min_length=2, max_length=120)
    address_number: int | None = Field(default=None, ge=1)
    contents: str | None = Field(default=None, min_length=2, max_length=500)
    attendant: str | None = Field(default=None, min_length=2, max_length=120)
    shipment_date: date | None = None
    status: ShipmentStatus | None = None
    translate_contents: bool = False

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        return "".join(value.upper().split()) if value else value

    @field_validator(
        "shipper_name", "shipper_address", "consignee_name", "contents", "attendant"
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        return " ".join(value.strip().split()) if value else value


class ShipmentResponse(ShipmentBase):
    id: str
    consignee_address: str
    phone: str
    customs_type: str = "UNSOLICITED"
    quantity: int = 2
    print_order: int = 0
    created_at: datetime
    updated_at: datetime


class ShipmentList(BaseModel):
    items: list[ShipmentResponse]
    total: int
    page: int
    limit: int
    pages: int


class ShipmentReorder(BaseModel):
    shipment_ids: list[str] = Field(min_length=1, max_length=500)

    @field_validator("shipment_ids")
    @classmethod
    def unique_ids(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("La lista de bauchers contiene elementos repetidos")
        return value


class DashboardStats(BaseModel):
    total_shipments: int
    active_bags: int
    registered: int
    in_transit: int
    delivered: int
    total_addresses: int
    shipments_by_bag: list[dict]


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class TranslateResponse(BaseModel):
    original: str
    translated: str


class HealthResponse(BaseModel):
    status: str
    database: str


class ErrorResponse(BaseModel):
    detail: str
