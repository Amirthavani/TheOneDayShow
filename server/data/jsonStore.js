import { access, mkdir, readFile, rename, writeFile } from "fs/promises";
import { randomBytes } from "crypto";
import { dirname, resolve } from "path";
import { initialJewelry } from "../seed.js";

const dataPath = resolve(process.cwd(), process.env.JSON_DATA_PATH || "./data/one-day-show.json");
let writeQueue = Promise.resolve();

function createId() {
  return randomBytes(12).toString("hex");
}

function assignMissingCodes(items) {
  const usedCodes = new Set(items.map((item) => item.code).filter(Boolean));
  let codeNumber = 1;
  items.forEach((item) => {
    if (item.code) return;
    let code;
    do {
      code = String(codeNumber++).padStart(3, "0");
    } while (usedCodes.has(code));
    item.code = code;
    usedCodes.add(code);
  });
}

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeCode(code, items, currentId) {
  if (typeof code !== "string" || !code.trim()) throw inputError("Jewelry code is required.");
  const normalized = code.trim().toUpperCase().replace(/^ODS-?/, "");
  if (items.some((item) => item._id !== currentId && item.code === normalized)) {
    throw inputError("Jewelry code must be unique.");
  }
  return normalized;
}

function createInitialData() {
  const now = new Date().toISOString();
  return {
    jewelry: initialJewelry.map((item) => ({
      ...item,
      _id: createId(),
      images: [item.image],
      available: true,
      views: 0,
      likes: 0,
      createdAt: now,
      updatedAt: now
    })),
    enquiries: [],
    rentals: []
  };
}

async function readData() {
  return JSON.parse(await readFile(dataPath, "utf8"));
}

async function writeData(data) {
  const temporaryPath = `${dataPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temporaryPath, dataPath);
}

async function mutate(callback) {
  const operation = writeQueue.catch(() => {}).then(async () => {
    const data = await readData();
    const result = await callback(data);
    await writeData(data);
    return result;
  });
  writeQueue = operation;
  return operation;
}

export async function initializeJsonStore() {
  await mkdir(dirname(dataPath), { recursive: true });
  try {
    await access(dataPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeData(createInitialData());
    return;
  }
  await mutate((data) => {
    assignMissingCodes(data.jewelry);
    data.jewelry.forEach((item) => {
      item.code = item.code.replace(/^ODS-?/, "");
      if (["Classic", "Traditional"].includes(item.style)) item.style = "Casual";
      if (["Festive", "Statement"].includes(item.style)) item.style = "Party";
      if (typeof item.premium !== "boolean") {
        item.premium = item.name === "Temple Bloom Haaram";
      }
    });
  });
}

export async function listJewelry({ category, search, includeUnavailable = false, premiumOnly = false } = {}) {
  const data = await readData();
  return data.jewelry
    .filter((item) => includeUnavailable || item.available)
    .filter((item) => !premiumOnly || item.premium)
    .filter((item) => !category || category === "All" || item.category === category)
    .filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((first, second) => first.code.localeCompare(second.code, undefined, { numeric: true }));
}

export async function findJewelry(id, incrementViews = false) {
  if (!incrementViews) {
    const data = await readData();
    return data.jewelry.find((item) => item._id === id) || null;
  }
  return mutate((data) => {
    const item = data.jewelry.find((entry) => entry._id === id);
    if (!item) return null;
    item.views += 1;
    item.updatedAt = new Date().toISOString();
    return item;
  });
}

export async function createJewelry(values) {
  return mutate((data) => {
    const now = new Date().toISOString();
    const item = {
      _id: createId(), views: 0, likes: 0, featured: false, available: true,
      images: [], ...values, code: normalizeCode(values.code, data.jewelry), createdAt: now, updatedAt: now
    };
    data.jewelry.unshift(item);
    return item;
  });
}

export async function updateJewelry(id, values) {
  return mutate((data) => {
    const item = data.jewelry.find((entry) => entry._id === id);
    if (!item) return null;
    const code = values.code === undefined ? item.code : normalizeCode(values.code, data.jewelry, id);
    Object.assign(item, values, { code, updatedAt: new Date().toISOString() });
    return item;
  });
}

export async function removeJewelry(id) {
  return mutate((data) => {
    const index = data.jewelry.findIndex((item) => item._id === id);
    if (index === -1) return null;
    return data.jewelry.splice(index, 1)[0];
  });
}

export async function swapJewelryCode(id, direction) {
  return mutate((data) => {
    const items = [...data.jewelry].sort((first, second) => first.code.localeCompare(second.code, undefined, { numeric: true }));
    const currentIndex = items.findIndex((item) => item._id === id);
    const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= items.length) return null;
    const current = items[currentIndex];
    const target = items[targetIndex];
    [current.code, target.code] = [target.code, current.code];
    current.updatedAt = new Date().toISOString();
    target.updatedAt = current.updatedAt;
    return [current, target];
  });
}

export async function incrementLikes(id) {
  return mutate((data) => {
    const item = data.jewelry.find((entry) => entry._id === id);
    if (!item) return null;
    item.likes += 1;
    item.updatedAt = new Date().toISOString();
    return item;
  });
}

export async function listRentalsForJewelry(ids) {
  const data = await readData();
  return data.rentals.filter((rental) => ids.includes(rental.jewelry));
}

export async function listRentals() {
  const data = await readData();
  return [...data.rentals].sort((first, second) => new Date(first.eventDate) - new Date(second.eventDate));
}

export async function hasOverlappingRental(jewelryId, start, end, excludedRentalId) {
  const rentals = await listRentalsForJewelry([jewelryId]);
  return rentals.some((rental) => rental._id !== excludedRentalId && ["pending", "confirmed"].includes(rental.status) &&
    new Date(rental.eventDate) <= end && new Date(rental.returnDate) >= start);
}

export async function createRental(values) {
  return mutate((data) => {
    const now = new Date().toISOString();
    const rental = { _id: createId(), status: "pending", ...values, createdAt: now, updatedAt: now };
    data.rentals.unshift(rental);
    return rental;
  });
}

export async function findRental(id) {
  const data = await readData();
  return data.rentals.find((rental) => rental._id === id) || null;
}

export async function updateRental(id, values) {
  return mutate((data) => {
    const rental = data.rentals.find((entry) => entry._id === id);
    if (!rental) return null;
    Object.assign(rental, values, { updatedAt: new Date().toISOString() });
    return rental;
  });
}

export async function hasRentalHistory(jewelryId) {
  const rentals = await listRentalsForJewelry([jewelryId]);
  return rentals.some((rental) => rental.status !== "cancelled");
}

export async function listEnquiries() {
  const data = await readData();
  return data.enquiries.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function createEnquiry(values) {
  return mutate((data) => {
    const now = new Date().toISOString();
    const enquiry = { _id: createId(), status: "new", ...values, createdAt: now, updatedAt: now };
    data.enquiries.unshift(enquiry);
    return enquiry;
  });
}

export async function updateEnquiryStatus(id, status) {
  return mutate((data) => {
    const enquiry = data.enquiries.find((entry) => entry._id === id);
    if (!enquiry) return null;
    enquiry.status = status;
    enquiry.updatedAt = new Date().toISOString();
    return enquiry;
  });
}
