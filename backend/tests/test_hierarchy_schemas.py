import pytest
from pydantic import ValidationError

from app.schemas import BagCreate, BagUpdate, ManifestCreate, ManifestUpdate, ShipmentCreate, ShipmentUpdate


def test_manifest_no_longer_owns_attendant():
    manifest = ManifestCreate(name="  Envío semanal  ", manifest_date="2026-08-29")

    assert manifest.name == "Envío semanal"
    assert "attendant" not in manifest.model_dump()


def test_manifest_update_accepts_date_and_normalizes_name():
    update = ManifestUpdate(name="  Envío   actualizado  ", manifest_date="2026-09-01")

    assert update.name == "Envío actualizado"
    assert update.model_dump(mode="json")["manifest_date"] == "2026-09-01"

    with pytest.raises(ValidationError):
        ManifestUpdate(manifest_date=None)


def test_bag_requires_and_normalizes_attendant():
    bag = BagCreate(number=3, name="  Maleta norte  ", attendant="  María   López  ")

    assert bag.name == "Maleta norte"
    assert bag.attendant == "María López"

    with pytest.raises(ValidationError):
        BagCreate(number=3, attendant="   ")


def test_bag_update_normalizes_attendant():
    update = BagUpdate(attendant="  Ana   Pérez  ")

    assert update.model_dump(exclude_unset=True) == {"attendant": "Ana Pérez"}


def test_shipment_price_defaults_to_two_and_can_be_updated():
    shipment = ShipmentCreate(
        code="TEST-1",
        bag_number=1,
        shipper_name="Persona que envía",
        shipper_address="Guatemala, Guatemala",
        consignee_name="Persona que recibe",
        contents="ROPA Y ALIMENTOS",
        attendant="Encargado",
    )

    assert shipment.quantity == 2
    assert ShipmentUpdate(quantity=15).model_dump(exclude_unset=True)["quantity"] == 15

    with pytest.raises(ValidationError):
        ShipmentUpdate(quantity=0)
