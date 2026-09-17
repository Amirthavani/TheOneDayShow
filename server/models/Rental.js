import mongoose from "mongoose";

const rentalSchema = new mongoose.Schema(
  {
    jewelry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jewelry",
      required: true
    },
    customerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    eventDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "returned", "cancelled"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Rental", rentalSchema);
