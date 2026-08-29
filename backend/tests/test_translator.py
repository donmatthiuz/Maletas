from app.services import translator
from app.services.translator import normalize_spanish, translate_contents


def test_normalizes_accents_and_commas():
    assert normalize_spanish(" café,  pan , miel ") == "CAFE, PAN, MIEL"


def test_translates_known_manifest_contents():
    assert translate_contents("pan, vegetales cocidos, pepitas") == "BREAD, COOKED VEGETABLES, NUTS"


def test_translates_terms_outside_the_workbook_dictionary(monkeypatch):
    monkeypatch.setattr(translator, "translate_online", lambda value: "CORN TAMALE")
    assert translate_contents("Tamal de elote") == "CORN TAMALE"


def test_keeps_normalized_text_when_provider_is_unavailable(monkeypatch):
    def unavailable(_: str) -> str:
        raise ConnectionError("offline")

    monkeypatch.setattr(translator, "translate_online", unavailable)
    assert translate_contents("Tamal de elote") == "TAMAL DE ELOTE"
