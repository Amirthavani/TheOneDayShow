import "dotenv/config";
import cors from "cors";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { mkdirSync } from "fs";
import { extname, join } from "path";
import * as store from "./data/store.js";

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/One_day_show";
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  "http://localhost:5173",
  "http://localhost:5174"
].filter(Boolean);
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionDuration = 8 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET || adminPassword;
const uploadDirectory = join(process.cwd(), "public", "uploads");
mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => {
      callback(null, `${Date.now()}-${randomBytes(8).toString("hex")}${extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      const error = new Error("Only image files can be uploaded.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  }
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("This origin is not allowed to access the API."));
  },
  credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static(uploadDirectory));

function credentialsMatch(suppliedValue, expectedValue) {
  return typeof suppliedValue === "string" &&
    suppliedValue.length === expectedValue.length &&
    timingSafeEqual(Buffer.from(suppliedValue), Buffer.from(expectedValue));
}

function sessionToken(request) {
  const cookie = request.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)ods_admin_session=([^;]+)/);
  return match ? match[1] : null;
}

function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + sessionDuration })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function hasValidSession(token) {
  if (!token || !sessionSecret) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expectedSignature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (signature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return false;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).expiresAt > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(request, response, next) {
  if (!adminUsername || !adminPassword) {
    return response.status(503).json({ message: "Admin access is not configured." });
  }
  const token = sessionToken(request);
  if (!hasValidSession(token)) {
    return response.status(401).json({ message: "Admin access was denied." });
  }
  next();
}

function serializeJewelry(item) {
  const jewelry = typeof item.toObject === "function" ? item.toObject() : item;
  const images = jewelry.images?.length ? jewelry.images : [jewelry.image].filter(Boolean);
  return { ...jewelry, image: images[0] || "", images };
}

async function addAvailability(items) {
  const jewelry = items.map(serializeJewelry);
  if (jewelry.length === 0) return jewelry;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rentals = (await store.listRentalsForJewelry(jewelry.map((item) => item._id)))
    .filter((rental) => ["pending", "confirmed"].includes(rental.status) && new Date(rental.returnDate) >= today)
    .sort((first, second) => new Date(first.eventDate) - new Date(second.eventDate));
  const rentalsByJewelry = new Map();
  rentals.forEach((rental) => {
    const key = rental.jewelry.toString();
    rentalsByJewelry.set(key, [...(rentalsByJewelry.get(key) || []), rental]);
  });
  return jewelry.map((item) => {
    const bookings = rentalsByJewelry.get(item._id.toString()) || [];
    const activeBooking = bookings.find((booking) =>
      new Date(booking.eventDate) <= today && new Date(booking.returnDate) >= today
    );
    const nextBooking = bookings.find((booking) => new Date(booking.eventDate) > today);
    const relevantBooking = activeBooking || nextBooking;
    const availableAfter = activeBooking ? new Date(activeBooking.returnDate) : null;
    if (availableAfter) availableAfter.setDate(availableAfter.getDate() + 1);
    return {
      ...item,
      isAvailableToday: item.available && !activeBooking,
      unavailableFrom: relevantBooking?.eventDate || null,
      unavailableUntil: relevantBooking?.returnDate || null,
      availableAfter,
      bookedPeriods: bookings.map((booking) => ({
        eventDate: booking.eventDate,
        returnDate: booking.returnDate
      }))
    };
  });
}

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    dataSource: store.dataSource,
    database: store.dataSource === "mongodb" ? mongoose.connection.name : "json"
  });
});

app.get("/api/jewelry", async (request, response, next) => {
  try {
    response.json(await addAvailability(await store.listJewelry({
      category: request.query.category,
      search: request.query.search,
      includeUnavailable: true,
      premiumOnly: request.query.premium === "true"
    })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/jewelry/:id", async (request, response, next) => {
  try {
    const item = await store.findJewelry(request.params.id, true);
    if (!item) return response.status(404).json({ message: "Jewelry item was not found." });
    response.json((await addAvailability([item]))[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/api/jewelry/:id/like", async (request, response, next) => {
  try {
    const item = await store.incrementLikes(request.params.id);
    if (!item || !item.available) return response.status(404).json({ message: "Jewelry item was not found." });
    response.json({ likes: item.likes });
  } catch (error) {
    next(error);
  }
});

app.post("/api/enquiries", async (request, response, next) => {
  try {
    const { name, email, phone, eventDate, message } = request.body;
    if (![name, email, phone, message].every((value) => typeof value === "string" && value.trim())) {
      return response.status(400).json({ message: "Please complete your contact details and message." });
    }
    const enquiry = await store.createEnquiry({ name, email, phone, eventDate: eventDate || undefined, message });
    response.status(201).json(enquiry);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/login", (request, response) => {
  if (!adminUsername || !adminPassword) {
    return response.status(503).json({ message: "Admin access is not configured." });
  }
  const { username, password } = request.body;
  if (!credentialsMatch(username, adminUsername) || !credentialsMatch(password, adminPassword)) {
    return response.status(401).json({ message: "Invalid username or password." });
  }
  const token = createSessionToken();
  response.cookie("ods_admin_session", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "strict",
    secure: isProduction,
    maxAge: sessionDuration
  });
  response.status(204).end();
});

app.post("/api/admin/logout", requireAdmin, (request, response) => {
  response.clearCookie("ods_admin_session", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "strict",
    secure: isProduction
  });
  response.status(204).end();
});

app.get("/api/admin/session", requireAdmin, (_request, response) => {
  response.status(204).end();
});

app.post("/api/rentals", async (request, response, next) => {
  try {
    const { jewelryId, customerName, email, phone, eventDate, returnDate } = request.body;
    if (![jewelryId, customerName, email, phone, eventDate, returnDate].every(Boolean)) {
      return response.status(400).json({ message: "Please complete all booking details." });
    }

    const start = new Date(eventDate);
    const end = new Date(returnDate);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) {
      return response.status(400).json({ message: "Choose a valid rental period." });
    }

    const item = await store.findJewelry(jewelryId);
    if (!item || !item.available) {
      return response.status(404).json({ message: "This piece is no longer available." });
    }

    const overlappingRental = await store.hasOverlappingRental(item._id, start, end);
    if (overlappingRental) {
      return response.status(409).json({ message: "This piece is already reserved for those dates." });
    }

    const days = Math.floor((end - start) / 86_400_000) + 1;
    const rental = await store.createRental({
      jewelry: item._id,
      customerName,
      email,
      phone,
      eventDate: start,
      returnDate: end,
      total: days * item.pricePerDay,
      status: "pending"
    });

    response.status(201).json({ rental, item });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/jewelry", requireAdmin, async (_request, response, next) => {
  try {
    response.json(await addAvailability(await store.listJewelry({ includeUnavailable: true })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/uploads", requireAdmin, upload.array("photos", 10), (request, response) => {
  response.status(201).json({ images: request.files.map((file) => `/uploads/${file.filename}`) });
});

app.post("/api/admin/jewelry", requireAdmin, async (request, response, next) => {
  try {
    const jewelry = await store.createJewelry(request.body);
    response.status(201).json(jewelry);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/jewelry/:id", requireAdmin, async (request, response, next) => {
  try {
    const jewelry = await store.updateJewelry(request.params.id, request.body);
    if (!jewelry) return response.status(404).json({ message: "Jewelry item was not found." });
    response.json(jewelry);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/jewelry/:id/order", requireAdmin, async (request, response, next) => {
  try {
    const { direction } = request.body;
    if (!["up", "down"].includes(direction)) {
      return response.status(400).json({ message: "Choose a valid movement direction." });
    }
    const swappedItems = await store.swapJewelryCode(request.params.id, direction);
    if (!swappedItems) {
      return response.status(400).json({ message: "This product cannot be moved further in that direction." });
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/jewelry/:id", requireAdmin, async (request, response, next) => {
  try {
    if (await store.hasRentalHistory(request.params.id)) {
      return response.status(409).json({ message: "This item has rental history and cannot be deleted." });
    }
    const jewelry = await store.removeJewelry(request.params.id);
    if (!jewelry) return response.status(404).json({ message: "Jewelry item was not found." });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/enquiries", requireAdmin, async (_request, response, next) => {
  try {
    response.json(await store.listEnquiries());
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/rentals", requireAdmin, async (_request, response, next) => {
  try {
    const [rentals, jewelry] = await Promise.all([
      store.listRentals(),
      store.listJewelry({ includeUnavailable: true })
    ]);
    const jewelryById = new Map(jewelry.map((item) => [item._id.toString(), item]));
    response.json(rentals.filter((rental) => ["pending", "confirmed"].includes(rental.status)).map((rental) => {
      const item = jewelryById.get(rental.jewelry.toString());
      return {
        ...rental,
        jewelryId: item?._id || null,
        jewelryCode: item?.code || "Removed item",
        jewelryName: item?.name || "Removed jewelry"
      };
    }));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/rentals/:id", requireAdmin, async (request, response, next) => {
  try {
    const rental = await store.findRental(request.params.id);
    if (!rental) return response.status(404).json({ message: "Reservation was not found." });
    const eventDate = request.body.eventDate || rental.eventDate;
    const returnDate = request.body.returnDate || rental.returnDate;
    const start = new Date(eventDate);
    const end = new Date(returnDate);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) {
      return response.status(400).json({ message: "Choose a valid rental period." });
    }
    const status = request.body.status || rental.status;
    if (!["pending", "confirmed", "returned", "cancelled"].includes(status)) {
      return response.status(400).json({ message: "Choose a valid reservation status." });
    }
    if (["pending", "confirmed"].includes(status) &&
        await store.hasOverlappingRental(rental.jewelry, start, end, rental._id.toString())) {
      return response.status(409).json({ message: "This piece is already reserved for those dates." });
    }
    const updatedRental = await store.updateRental(request.params.id, {
      eventDate: start,
      returnDate: end,
      status
    });
    response.json(updatedRental);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/enquiries/:id", requireAdmin, async (request, response, next) => {
  try {
    const { status } = request.body;
    if (!["new", "contacted", "closed"].includes(status)) {
      return response.status(400).json({ message: "Choose a valid enquiry status." });
    }
    const enquiry = await store.updateEnquiryStatus(request.params.id, status);
    if (!enquiry) return response.status(404).json({ message: "Enquiry was not found." });
    response.json(enquiry);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ message: "Upload up to ten images, each no larger than 5 MB." });
  }
  response.status(error.status || 500).json({
    message: error.status ? error.message : "Unable to complete that request. Please try again."
  });
});

async function start() {
  await store.initializeStore(mongoUri);
  app.listen(port, () => console.log(`One Day Show API listening on port ${port}.`));
}

start().catch((error) => {
  console.error("Could not start the API:", error);
  process.exit(1);
});
