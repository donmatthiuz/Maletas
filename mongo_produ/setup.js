/*
 * Estructura de producción para MongoDB Atlas.
 *
 * Uso:
 *   mongosh "mongodb+srv://USUARIO:CLAVE@CLUSTER.mongodb.net/" \
 *     --file mongo_produ/setup.js
 *
 * El script es idempotente: se puede ejecutar más de una vez.
 */

const DATABASE_NAME = "maletas";
const targetDb = db.getSiblingDB(DATABASE_NAME);

const validators = {
  addresses: {
    $jsonSchema: {
      bsonType: "object",
      title: "Dirección",
      required: ["number", "address", "phone"],
      properties: {
        _id: { bsonType: "objectId" },
        number: { bsonType: "int", minimum: 1 },
        address: { bsonType: "string", minLength: 5, maxLength: 240 },
        phone: { bsonType: "string", minLength: 7, maxLength: 24 },
      },
      additionalProperties: true,
    },
  },
  manifests: {
    $jsonSchema: {
      bsonType: "object",
      title: "Manifiesto",
      required: ["name", "manifest_date", "attendant", "created_at", "updated_at"],
      properties: {
        _id: { bsonType: "objectId" },
        name: { bsonType: "string", minLength: 2, maxLength: 120 },
        manifest_date: {
          bsonType: "string",
          pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
        },
        attendant: { bsonType: "string", minLength: 2, maxLength: 120 },
        legacy_date: {
          bsonType: ["string", "null"],
          pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
        },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
      additionalProperties: true,
    },
  },
  bags: {
    $jsonSchema: {
      bsonType: "object",
      title: "Maleta",
      required: ["manifest_id", "number", "name", "created_at", "updated_at"],
      properties: {
        _id: { bsonType: "objectId" },
        manifest_id: { bsonType: "string", minLength: 24, maxLength: 24 },
        number: { bsonType: "int", minimum: 1, maximum: 999 },
        name: { bsonType: "string", minLength: 1, maxLength: 120 },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
      additionalProperties: true,
    },
  },
  shipments: {
    $jsonSchema: {
      bsonType: "object",
      title: "Baucher",
      required: [
        "code",
        "bag_number",
        "shipper_name",
        "shipper_address",
        "consignee_name",
        "address_number",
        "consignee_address",
        "phone",
        "contents",
        "attendant",
        "shipment_date",
        "status",
        "customs_type",
        "quantity",
        "created_at",
        "updated_at",
      ],
      properties: {
        _id: { bsonType: "objectId" },
        code: { bsonType: "string", minLength: 1, maxLength: 32 },
        manifest_id: { bsonType: ["string", "null"], minLength: 24, maxLength: 24 },
        bag_id: { bsonType: ["string", "null"], minLength: 24, maxLength: 24 },
        bag_number: { bsonType: "int", minimum: 1, maximum: 999 },
        print_order: { bsonType: "int", minimum: 1 },
        shipper_name: { bsonType: "string", minLength: 2, maxLength: 120 },
        shipper_address: { bsonType: "string", minLength: 3, maxLength: 240 },
        consignee_name: { bsonType: "string", minLength: 2, maxLength: 120 },
        address_number: { bsonType: "int", minimum: 1 },
        consignee_address: { bsonType: "string", minLength: 5, maxLength: 240 },
        phone: { bsonType: "string", minLength: 7, maxLength: 24 },
        contents: { bsonType: "string", minLength: 2, maxLength: 500 },
        attendant: { bsonType: "string", minLength: 2, maxLength: 120 },
        shipment_date: {
          bsonType: "string",
          pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
        },
        status: {
          bsonType: "string",
          enum: ["registrado", "en_transito", "entregado"],
        },
        customs_type: { bsonType: "string", minLength: 1, maxLength: 80 },
        quantity: { bsonType: "int", minimum: 1 },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
      additionalProperties: true,
    },
  },
};

function ensureCollection(name, validator) {
  const exists = targetDb.getCollectionInfos({ name }).length > 0;
  const options = {
    validator,
    validationLevel: "moderate",
    validationAction: "error",
  };

  if (exists) {
    targetDb.runCommand({ collMod: name, ...options });
    print(`✓ Colección actualizada: ${name}`);
  } else {
    targetDb.createCollection(name, options);
    print(`✓ Colección creada: ${name}`);
  }
}

Object.entries(validators).forEach(([name, validator]) => {
  ensureCollection(name, validator);
});

targetDb.addresses.createIndex(
  { number: 1 },
  { name: "number_1", unique: true },
);
targetDb.addresses.createIndex(
  { address: "text", phone: "text" },
  { name: "address_text_phone_text" },
);

targetDb.manifests.createIndex(
  { legacy_date: 1 },
  { name: "legacy_date_1", unique: true, sparse: true },
);
targetDb.manifests.createIndex(
  { manifest_date: 1 },
  { name: "manifest_date_1" },
);

targetDb.bags.createIndex(
  { manifest_id: 1, number: 1 },
  { name: "manifest_id_1_number_1", unique: true },
);

targetDb.shipments.createIndex({ code: 1 }, { name: "code_1" });
targetDb.shipments.createIndex(
  { bag_id: 1, print_order: 1 },
  { name: "bag_id_1_print_order_1" },
);
targetDb.shipments.createIndex(
  { manifest_id: 1 },
  { name: "manifest_id_1" },
);
targetDb.shipments.createIndex(
  { bag_number: 1, shipment_date: -1 },
  { name: "bag_number_1_shipment_date_-1" },
);
targetDb.shipments.createIndex(
  {
    code: "text",
    shipper_name: "text",
    consignee_name: "text",
    contents: "text",
  },
  { name: "shipment_search" },
);

print("");
print(`Base '${DATABASE_NAME}' preparada correctamente.`);
print("Colecciones: addresses, manifests, bags, shipments");
