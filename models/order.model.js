import mongoose from "mongoose";

// YAHI SABSE ZAROORI HISSA HAI
const shippingAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  type: { type: String, default: "Home" }, // Yeh optional hai, lekin accha hai
});

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderItems: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
      },
    ],
    // --- YAHAN PURANE SCHEMA KO NAYE SCHEMA SE REPLACE KIYA GAYA HAI ---
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    totalPrice: { type: Number, required: true },
    orderStatus: {
      type: String,
      required: true,
      enum: [
        "Pending",
        "Paid",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Paid", // Default "Paid" kar diya, kyunki payment ke baad hi order banta hai
    },
    paymentId: { type: String },
    razorpayOrderId: { type: String },
    paymentMethod: {
      type: String,
      enum: ["COD", "Razorpay"],
      required: true,
      default: "Razorpay", // Default "Razorpay" kar diya
    },
    shipmentDetails: {
      shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment" },
      trackingNumber: { type: String },
      courier: { type: String },
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
