from app.services.translator import normalize_spanish, translate_contents


def test_normalizes_accents_and_commas():
    assert normalize_spanish(" café,  pan , miel ") == "CAFE, PAN, MIEL"


def test_translates_known_manifest_contents():
    assert translate_contents("pan, vegetales cocidos, pepitas") == "BREAD, COOKED VEGETABLES, NUTS"


def test_keeps_unknown_terms_in_uppercase():
    assert translate_contents("Tamal de elote") == "TAMAL DE ELOTE"

