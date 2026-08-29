/* Comprueba conteos e integridad referencial sin mostrar datos personales. */

const databaseName = process.env.MONGO_DATABASE || "maletas";
const targetDb = db.getSiblingDB(databaseName);

const manifests = targetDb.manifests.find({}, { _id: 1 }).toArray();
const bags = targetDb.bags.find({}, { _id: 1, manifest_id: 1, number: 1, attendant: 1 }).toArray();
const shipments = targetDb.shipments.find(
  {},
  { _id: 1, manifest_id: 1, bag_id: 1, bag_number: 1, attendant: 1, print_order: 1 },
).toArray();

const manifestIds = new Set(manifests.map((item) => item._id.toString()));
const bagsById = new Map(bags.map((item) => [item._id.toString(), item]));

const orphanBags = bags.filter((item) => !manifestIds.has(item.manifest_id));
const bagsWithoutAttendant = bags.filter((item) => !item.attendant || item.attendant.trim().length < 2);
const invalidShipments = shipments.filter((item) => {
  const bag = bagsById.get(item.bag_id);
  return !bag
    || !manifestIds.has(item.manifest_id)
    || bag.manifest_id !== item.manifest_id
    || bag.number !== item.bag_number
    || bag.attendant !== item.attendant;
});

const duplicatePrintOrders = targetDb.shipments.aggregate([
  { $match: { bag_id: { $type: "string" }, print_order: { $type: "number" } } },
  { $group: { _id: { bag_id: "$bag_id", print_order: "$print_order" }, total: { $sum: 1 } } },
  { $match: { total: { $gt: 1 } } },
  { $count: "total" },
]).toArray()[0]?.total || 0;

const result = {
  database: databaseName,
  counts: {
    addresses: targetDb.addresses.countDocuments({}),
    manifests: manifests.length,
    bags: bags.length,
    shipments: shipments.length,
  },
  integrity: {
    orphan_bags: orphanBags.length,
    bags_without_attendant: bagsWithoutAttendant.length,
    invalid_shipments: invalidShipments.length,
    duplicate_print_orders: duplicatePrintOrders,
  },
};

print(EJSON.stringify(result));

if (orphanBags.length || bagsWithoutAttendant.length || invalidShipments.length || duplicatePrintOrders) {
  throw new Error("La migración contiene relaciones inválidas.");
}
