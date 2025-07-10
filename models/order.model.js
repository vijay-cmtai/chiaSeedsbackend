import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
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
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    totalPrice: { 
      type: Number, 
      required: true 
    },
    orderStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Paid", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },

    paymentId: { 
      type: String 
    },
    razorpayOrderId: {
      type: String,
    },
    
    paymentMethod: {
      type: String,
      enum: ["COD", "Razorpay"],
      required: true,
      default: "COD"
    }

  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);