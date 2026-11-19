"""Database guard for destination addresses assigned by the current API."""

from pymongo import ASCENDING


DAILY_ADDRESS_INDEX = "shipment_date_1_address_number_1_new_assignments"
ADDRESS_ASSIGNMENT_VERSION = 2


async def ensure_new_address_assignment_index(database) -> None:
    """Protect new assignments without changing historical bauchers."""
    await database.shipments.create_index(
        [("shipment_date", ASCENDING), ("address_number", ASCENDING)],
        unique=True,
        name=DAILY_ADDRESS_INDEX,
        partialFilterExpression={
            "manifest_id": {"$type": "string"},
            "address_assignment_version": ADDRESS_ASSIGNMENT_VERSION,
        },
    )
