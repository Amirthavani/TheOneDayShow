import mongoose from "mongoose";
import { randomBytes } from "crypto";
import Enquiry from "../models/Enquiry.js";
import Jewelry from "../models/Jewelry.js";
import Rental from "../models/Rental.js";
import { seedJewelry } from "../seed.js";
import * as jsonStore from "./jsonStore.js";

const source = process.env.DATA_SOURCE || "json";
console.log("Amirthavani"+source)
if (!["mongodb", "json"].includes(source)) {
  throw new Error("DATA_SOURCE must be either \"mongodb\" or \"json\".");
}

export const dataSource = source;

export async function initializeStore(mongoUri) {
  if (source === "json") return jsonStore.initializeJsonStore();
  await mongoose.connect(mongoUri);
  await seedJewelry();
}

export async function listJewelry(options) {
  if (source === "json") return jsonStore.listJewelry(options);
  const filter = {};
  if (!options.includeUnavailable) filter.available = true;
  if (options.premiumOnly) filter.premium = true;
  if (options.category && options.category !== "All") filter.category = options.category;
  if (options.search) filter.name = { $regex: options.search, $options: "i" };
  return Jewelry.find(filter).sort({ code: 1 }).collation({ locale: "en", numericOrdering: true }).lean();
}

export async function findJewelry(id, incrementViews = false) {
  if (source === "json") return jsonStore.findJewelry(id, incrementViews);
  if (incrementViews) return Jewelry.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).lean();
  return Jewelry.findById(id).lean();
}

export async function createJewelry(values) {
  if (source === "json") return jsonStore.createJewelry(values);
  return (await Jewelry.create(values)).toObject();
}

export async function updateJewelry(id, values) {
  if (source === "json") return jsonStore.updateJewelry(id, values);
  return Jewelry.findByIdAndUpdate(id, values, { new: true, runValidators: true }).lean();
}

export async function removeJewelry(id) {
  if (source === "json") return jsonStore.removeJewelry(id);
  return Jewelry.findByIdAndDelete(id).lean();
}

export async function swapJewelryCode(id, direction) {
  if (source === "json") return jsonStore.swapJewelryCode(id, direction);
  const items = await Jewelry.find().sort({ code: 1 }).collation({ locale: "en", numericOrdering: true }).select("_id code").lean();
  const currentIndex = items.findIndex((item) => item._id.toString() === id);
  const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= items.length) return null;
  const current = items[currentIndex];
  const target = items[targetIndex];
  const temporaryCode = `SWAP-${randomBytes(12).toString("hex")}`;
  await Jewelry.updateOne({ _id: current._id }, { code: temporaryCode });
  await Jewelry.updateOne({ _id: target._id }, { code: current.code });
  await Jewelry.updateOne({ _id: current._id }, { code: target.code });
  return [current._id, target._id];
}

export async function incrementLikes(id) {
  if (source === "json") return jsonStore.incrementLikes(id);
  return Jewelry.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true }).lean();
}

export async function listRentalsForJewelry(ids) {
  if (source === "json") return jsonStore.listRentalsForJewelry(ids);
  return Rental.find({ jewelry: { $in: ids } }).sort({ eventDate: 1 }).lean();
}

export async function listRentals() {
  if (source === "json") return jsonStore.listRentals();
  return Rental.find().sort({ eventDate: 1 }).lean();
}

export async function hasOverlappingRental(jewelryId, start, end, excludedRentalId) {
  if (source === "json") return jsonStore.hasOverlappingRental(jewelryId, start, end, excludedRentalId);
  const filter = {
    jewelry: jewelryId, status: { $in: ["pending", "confirmed"] }, eventDate: { $lte: end }, returnDate: { $gte: start }
  };
  if (excludedRentalId) filter._id = { $ne: excludedRentalId };
  return Boolean(await Rental.exists({
    ...filter
  }));
}

export async function createRental(values) {
  if (source === "json") return jsonStore.createRental(values);
  return (await Rental.create(values)).toObject();
}

export async function findRental(id) {
  if (source === "json") return jsonStore.findRental(id);
  return Rental.findById(id).lean();
}

export async function updateRental(id, values) {
  if (source === "json") return jsonStore.updateRental(id, values);
  return Rental.findByIdAndUpdate(id, values, { new: true, runValidators: true }).lean();
}

export async function hasRentalHistory(jewelryId) {
  if (source === "json") return jsonStore.hasRentalHistory(jewelryId);
  return Boolean(await Rental.exists({ jewelry: jewelryId, status: { $ne: "cancelled" } }));
}

export async function listEnquiries() {
  if (source === "json") return jsonStore.listEnquiries();
  return Enquiry.find().sort({ createdAt: -1 }).lean();
}

export async function createEnquiry(values) {
  if (source === "json") return jsonStore.createEnquiry(values);
  return (await Enquiry.create(values)).toObject();
}

export async function updateEnquiryStatus(id, status) {
  if (source === "json") return jsonStore.updateEnquiryStatus(id, status);
  return Enquiry.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).lean();
}
