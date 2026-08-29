import re
import unicodedata


# Equivalencias recuperadas de la macro TRADUCTER del libro original.
TRANSLATIONS = {
    "VEGETALES COCIDOS": "COOKED VEGETABLES",
    "VEGETALES COSIDOS": "COOKED VEGETABLES",
    "VEGETAL COCIDO": "COOKED VEGETABLES",
    "VEGETAL COSIDO": "COOKED VEGETABLES",
    "SUPLEMENTOS VITAMINICOS": "VITAMIN SUPPLEMENTS",
    "SUPLEMENTO VITAMINICO": "VITAMIN SUPPLEMENTS",
    "SUPLEMENTO VITAMINICOS": "VITAMIN SUPPLEMENTS",
    "TINTES PARA CABELLO": "HAIR DYES",
    "TINTES DE CABELLO": "HAIR DYES",
    "TINTES CABELLO": "HAIR DYES",
    "REPUESTOS PARA CARRO": "AUTO PARTS",
    "REPUESTOS DE CARRO": "AUTO PARTS",
    "BOMBA PARA FUMIGAR": "PUMP SPRAY",
    "BOMBA DE FUMIGAR": "PUMP SPRAY",
    "MEDICINA NATURAL": "NATURAL MEDICINE",
    "MANTAS VINILICAS": "VINYL BLANKETS",
    "MANTA VINILICA": "VINYL BLANKET",
    "SOPA INSTANTANEA": "INSTANT SOUP",
    "CONDIMENTOS": "CONDIMENTS",
    "CONDIMENTO": "CONDIMENTS",
    "ACCESORIOS": "ACCESSORIES",
    "DECORACIONES": "DECORATIONS",
    "CIGARROS": "CIGARETTES",
    "COSMETICOS": "COSMETICS",
    "BILLETERAS": "WALLETS",
    "BILLETERA": "WALLET",
    "EMPANADAS": "EMPANADAS",
    "SOMBREROS": "HATS",
    "SOMBRERO": "HAT",
    "ALMOHADAS": "PILLOWS",
    "ALMOHADA": "PILLOW",
    "ALMOADAS": "PILLOWS",
    "ALMOADA": "PILLOW",
    "MEDICINA": "MEDICINE",
    "ZAPATOS": "SHOES",
    "HAMACAS": "HAMMOCKS",
    "CINCHOS": "BELTS",
    "PEPITAS": "NUTS",
    "PEPITA": "NUTS",
    "JUGUETES": "TOYS",
    "JUGUETE": "TOY",
    "REGALOS": "GIFTS",
    "REGALO": "GIFT",
    "GORRAS": "CAPS",
    "GORRA": "CAP",
    "DOCUMENTOS": "DOCUMENTS",
    "DOCUMENTO": "DOCUMENT",
    "BOLSOS": "PURSES",
    "BOLSAS": "BAGS",
    "CESTAS": "BASKETS",
    "SESTAS": "BASKETS",
    "OLLAS": "POTS",
    "OLLA": "POT",
    "LOCIONES": "LOTIONS",
    "CONSERVA": "PRESERVE",
    "DULCES": "CANDIES",
    "DULCE": "CANDY",
    "MANIAS": "PEANUTS",
    "MANIA": "PEANUTS",
    "POLLO": "CHICKEN",
    "QUESO": "CHEESE",
    "ROPA": "CLOTHES",
    "CAFE": "COFFEE",
    "MIEL": "HONEY",
    "PAPAS": "POTATOES",
    "PAN": "BREAD",
    "CREMA": "CREAM",
    "HARINA": "FLOUR",
    "SOPAS": "SOUPS",
    "SOPA": "SOUP",
}


def normalize_spanish(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.upper())
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"\s*,\s*", ", ", " ".join(plain.split())).strip(" ,")


def translate_contents(value: str) -> str:
    translated = normalize_spanish(value)
    for source in sorted(TRANSLATIONS, key=len, reverse=True):
        translated = re.sub(
            rf"\b{re.escape(source)}\b", TRANSLATIONS[source], translated, flags=re.IGNORECASE
        )
    return translated.upper()

