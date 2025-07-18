import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },

    // Asli daam (MRP) aur Discounted daam (Selling Price)
    originalPrice: { type: Number, required: true },
    price: { type: Number, required: true },

    stock: { type: Number, required: true, default: 0 },
    category: { type: String, required: true },

    // --- YE NAYE FIELDS ADD KIYE GAYE HAIN ---
    packagingType: { type: String, required: true },
    seedType: { type: String, required: true },
    speciality: { type: String, required: true },

    mainImage: { type: String, required: true },
    images: [{ type: String }],
    isPublished: { type: Boolean, default: true },

    // Shipping ke liye zaroori fields waise hi rakhe gaye hain
    weight: {
      type: Number,
      required: [true, "Product weight is required for shipping"],
      default: 0.5,
    },
    dimensions: {
      length: { type: Number, required: true, default: 10 },
      breadth: { type: Number, required: true, default: 10 },
      height: { type: Number, required: true, default: 5 },
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
