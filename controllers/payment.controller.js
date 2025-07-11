// src/controllers/payment.controller.js (CORRECTED CODE)

import Razorpay from "razorpay";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// === YAHAN PAR CHANGE KIYA GAYA HAI ===
const createRazorpayOrder = asyncHandler(async (req, res) => {
    const { addressId } = req.body;
    const userId = req.user._id;

    if (!addressId) {
        throw new ApiError(400, "Shipping address ID is required.");
    }

    const user = await User.findById(userId).populate("cart.product");

    if (!user || !user.cart || user.cart.length === 0) {
        throw new ApiError(400, "Your cart is empty. Cannot create an order.");
    }

    // Isko alag se nikalne ki zaroorat nahi, kyunki user object me pehle se hai.
    // const shippingAddress = user.addresses.id(addressId);
    // if (!shippingAddress) { ... }

    let totalPrice = 0;
    for (const item of user.cart) {
        if (!item.product) {
            // Hum is item ko ignore kar sakte hain ya error bhej sakte hain.
            // Abhi ke liye, error bejna behtar hai.
            throw new ApiError(400, `A product in your cart is no longer available. Please remove it to continue.`);
        }
        if (item.product.stock < item.quantity) {
            throw new ApiError(400, `Not enough stock for "${item.product.name}". Only ${item.product.stock} available.`);
        }
        totalPrice += item.product.price * item.quantity;
    }

    const options = {
        amount: Math.round(totalPrice * 100), // Amount in paise
        currency: "INR",
        receipt: crypto.randomBytes(10).toString("hex"),
    };

    const razorpayOrder = await razorpay.orders.create(options);

    if (!razorpayOrder) {
        throw new ApiError(500, "Something went wrong while creating the Razorpay order.");
    }
    
    // Frontend ko zaroori details bhejein taaki woh Razorpay popup khol sake
    const responsePayload = {
        orderId: razorpayOrder.id,
        currency: razorpayOrder.currency,
        amount: razorpayOrder.amount,
        key: process.env.RAZORPAY_KEY_ID, // Frontend ko key bhejna zaroori hai
        addressId: addressId // addressId ko wapas bhejein taaki verification ke samay kaam aaye
    };

    res.status(200).json(
        new ApiResponse(200, responsePayload, "Razorpay order created successfully")
    );
});


const verifyPaymentAndPlaceOrder = asyncHandler(async (req, res) => {
    // Is function mein koi badlav ki zaroorat nahi hai. Yeh bilkul sahi hai.
    // ...
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId } = req.body;
    const userId = req.user._id;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature !== expectedSign) {
        throw new ApiError(400, "Invalid payment signature. Payment verification failed.");
    }

    const user = await User.findById(userId).populate("cart.product");
    if (!user || !user.cart || user.cart.length === 0) {
        throw new ApiError(400, "Your cart is empty. Cannot place the order.");
    }
    
    const shippingAddressObject = user.addresses.id(addressId);
    if (!shippingAddressObject) {
        throw new ApiError(404, "Shipping address not found.");
    }
    const shippingAddress = shippingAddressObject.toObject();


    let totalPrice = 0;
    const orderItems = [];
    const productStockUpdates = [];

    for (const item of user.cart) {
        totalPrice += item.product.price * item.quantity;
        orderItems.push({
            name: item.product.name,
            product: item.product._id,
            quantity: item.quantity,
            price: item.product.price,
            mainImage: item.product.mainImage // Main image bhi save karein
        });
        productStockUpdates.push({
            updateOne: {
                filter: { _id: item.product._id },
                update: { $inc: { stock: -item.quantity } },
            },
        });
    }

    const newOrder = await Order.create({
        user: userId,
        orderItems,
        shippingAddress,
        totalPrice,
        paymentDetails: { // Payment details ko ek object me rakhein
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature,
            method: "Razorpay",
            status: "Paid",
        },
    });

    if (!newOrder) {
        throw new ApiError(500, "Something went wrong while placing the order after payment.");
    }

    await Product.bulkWrite(productStockUpdates);
    user.cart = [];
    await user.save({ validateBeforeSave: false });

    res.status(201).json(new ApiResponse(201, newOrder, "Payment verified and order placed successfully!"));
});

export {
    createRazorpayOrder,
    verifyPaymentAndPlaceOrder
};
