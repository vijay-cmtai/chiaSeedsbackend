// src/models/product.model.js

import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    category: { type: String, required: true },
    mainImage: { type: String, required: true },
    images: [{ type: String }],
    isPublished: { type: Boolean, default: true },

    // --- NAYE FIELDS ADD KIYE GAYE HAIN ---
    // Weight in kilograms (kg)
    weight: {
      type: Number,
      required: [true, "Product weight is required for shipping"],
      default: 0.5, // Default weight 0.5 kg (500g)
    },
    // Dimensions in centimeters (cm)
    dimensions: {
      length: { type: Number, required: true, default: 10 },
      breadth: { type: Number, required: true, default: 10 },
      height: { type: Number, required: true, default: 5 },
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
