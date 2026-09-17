import "dotenv/config";
import { mkdir, rename, writeFile } from "fs/promises";
import mongoose from "mongoose";
import { dirname, resolve } from "path";
import Enquiry from "../models/Enquiry.js";
import Jewelry from "../models/Jewelry.js";
import Rental from "../models/Rental.js";

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/One_day_show";
const dataPath = resolve(process.cwd(), process.env.JSON_DATA_PATH || "./data/one-day-show.json");

async function exportData() {
  await mongoose.connect(mongoUri);
  const [jewelry, enquiries, rentals] = await Promise.all([
    Jewelry.find().lean(),
    Enquiry.find().lean(),
    Rental.find().lean()
  ]);
  await mkdir(dirname(dataPath), { recursive: true });
  const temporaryPath = `${dataPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ jewelry, enquiries, rentals }, null, 2)}\n`, "utf8");
  await rename(temporaryPath, dataPath);
  await mongoose.disconnect();
  console.log(`Exported ${jewelry.length} jewelry items, ${enquiries.length} enquiries, and ${rentals.length} rentals to ${dataPath}.`);
}

exportData().catch(async (error) => {
  console.error("Could not export MongoDB data:", error);
  await mongoose.disconnect();
  process.exit(1);
});
