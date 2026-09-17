import mongoose from "mongoose";

const jewelrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    style: { type: String, required: true, trim: true, enum: ["Bridal", "Party", "Casual", "Festival"] },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    pricePerDay: { type: Number, required: true, min: 0 },
    deposit: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
    images: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    premium: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    views: { type: Number, default: 0, min: 0 },
    likes: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

export default mongoose.model("Jewelry", jewelrySchema);
