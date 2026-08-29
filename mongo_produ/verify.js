/* Verifica la estructura creada por setup.js sin modificar datos. */

const DATABASE_NAME = "maletas";
const targetDb = db.getSiblingDB(DATABASE_NAME);
const expectedIndexes = {
  addresses: ["_id_", "number_1", "address_text_phone_text"],
  manifests: ["_id_", "legacy_date_1", "manifest_date_1"],
  bags: ["_id_", "manifest_id_1_number_1"],
  shipments: [
    "_id_",
    "code_1",
    "bag_id_1_print_order_1",
    "manifest_id_1",
    "bag_number_1_shipment_date_-1",
    "shipment_search",
  ],
};

let hasErrors = false;

Object.entries(expectedIndexes).forEach(([name, requiredIndexes]) => {
  const info = targetDb.getCollectionInfos({ name })[0];
  if (!info) {
    print(`✗ Falta la colección: ${name}`);
    hasErrors = true;
    return;
  }

  const indexes = targetDb.getCollection(name).getIndexes().map((index) => index.name);
  const validationEnabled = Boolean(info.options && info.options.validator);
  const missingIndexes = requiredIndexes.filter((index) => !indexes.includes(index));
  if (!validationEnabled || missingIndexes.length) hasErrors = true;
  print(`✓ ${name}: validador=${validationEnabled ? "sí" : "no"}, índices=${indexes.join(", ")}`);
  if (missingIndexes.length) print(`  ✗ Índices faltantes: ${missingIndexes.join(", ")}`);
});

if (hasErrors) {
  throw new Error("La estructura de MongoDB está incompleta.");
}

print("");
print("✓ Estructura de Atlas verificada correctamente.");

