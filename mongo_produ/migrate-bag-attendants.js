/* Migra el remitente del manifiesto a cada maleta y sincroniza sus bauchers. */

const databaseName = process.env.MONGO_DATABASE || "maletas";
const targetDb = db.getSiblingDB(databaseName);
const now = new Date();

let bagsUpdated = 0;
let shipmentsUpdated = 0;

targetDb.bags.find({}).forEach((bag) => {
  const bagId = bag._id.toString();
  let attendant = typeof bag.attendant === "string" ? bag.attendant.trim() : "";

  if (!attendant) {
    const firstShipment = targetDb.shipments.findOne(
      { bag_id: bagId },
      { sort: { print_order: 1, created_at: 1 } },
    );
    const manifest = ObjectId.isValid(bag.manifest_id)
      ? targetDb.manifests.findOne({ _id: new ObjectId(bag.manifest_id) })
      : null;
    attendant = firstShipment?.attendant?.trim()
      || manifest?.attendant?.trim()
      || "DORIAN SANTIZO";

    const bagResult = targetDb.bags.updateOne(
      { _id: bag._id },
      { $set: { attendant, updated_at: now } },
    );
    bagsUpdated += bagResult.modifiedCount;
  }

  const shipmentResult = targetDb.shipments.updateMany(
    { bag_id: bagId, attendant: { $ne: attendant } },
    { $set: { attendant, updated_at: now } },
  );
  shipmentsUpdated += shipmentResult.modifiedCount;
});

const manifestsUpdated = targetDb.manifests.updateMany(
  { attendant: { $exists: true } },
  { $unset: { attendant: "" }, $set: { updated_at: now } },
).modifiedCount;

print(EJSON.stringify({
  database: databaseName,
  bags_updated: bagsUpdated,
  shipments_updated: shipmentsUpdated,
  manifests_cleaned: manifestsUpdated,
}));
