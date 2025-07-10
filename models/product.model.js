// src/models/product.model.js (Assuming this is your model file)

import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    category: { type: String, required: true },

    // === THE FIX IS HERE ===
    mainImage: { type: String, required: true }, // The primary image URL
    images: [{ type: String }], // Array of other image URLs

    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
