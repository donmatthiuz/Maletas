/* Inspección de conteos usada antes de una migración. No modifica datos. */

const databaseName = process.env.MONGO_DATABASE || "maletas";
const targetDb = db.getSiblingDB(databaseName);
const collections = ["addresses", "manifests", "bags", "shipments"];
const counts = Object.fromEntries(
  collections.map((name) => [name, targetDb.getCollection(name).countDocuments({})]),
);

print(EJSON.stringify({ database: databaseName, counts }));

