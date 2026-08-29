from pathlib import Path

from app.services.importer import read_workbook


def test_imports_original_workbook():
    source = Path(__file__).parents[2] / "MANIFIESTO MALETAS 21 DE AGOSTO DE 2026 (1).xlsm"
    addresses, shipments = read_workbook(str(source))
    assert len(addresses) == 99
    assert len(shipments) == 38
    assert shipments[0]["code"] == "201K"
    assert shipments[-1]["bag_number"] == 3
