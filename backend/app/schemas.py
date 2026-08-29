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


class ShipmentBase(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    bag_number: int = Field(ge=1, le=99)
    shipper_name: str = Field(min_length=2, max_length=120)
    shipper_address: str = Field(min_length=3, max_length=240)
    consignee_name: str = Field(min_length=2, max_length=120)
    address_number: int = Field(ge=1)
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
    bag_number: int | None = Field(default=None, ge=1, le=99)
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
    created_at: datetime
    updated_at: datetime


class ShipmentList(BaseModel):
    items: list[ShipmentResponse]
    total: int
    page: int
    limit: int
    pages: int


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
