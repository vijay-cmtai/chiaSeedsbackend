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

    const shippingAddress = user.addresses.id(addressId);
    if (!shippingAddress) {
        throw new ApiError(404, "Shipping address not found in your profile.");
    }

    let totalPrice = 0;
    for (const item of user.cart) {
        if (!item.product) {
            throw new ApiError(400, "A product in your cart is no longer available. Please remove it.");
        }
        if (item.product.stock < item.quantity) {
            throw new ApiError(400, `Not enough stock for "${item.product.name}". Only ${item.product.stock} available.`);
        }
        totalPrice += item.product.price * item.quantity;
    }

    const options = {
        amount: Number(totalPrice * 100),
        currency: "INR",
        receipt: crypto.randomBytes(10).toString("hex"),
    };

    const razorpayOrder = await razorpay.orders.create(options);

    if (!razorpayOrder) {
        throw new ApiError(500, "Something went wrong while creating the Razorpay order.");
    }
    
    res.status(200).json(
        new ApiResponse(200, razorpayOrder, "Razorpay order created successfully")
    );
});

const verifyPaymentAndPlaceOrder = asyncHandler(async (req, res) => {
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
    
    const shippingAddress = user.addresses.id(addressId);
    if (!shippingAddress) {
        throw new ApiError(404, "Shipping address not found.");
    }

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
        shippingAddress: shippingAddress.toObject(),
        totalPrice,
        orderStatus: "Paid",
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        paymentMethod: "Razorpay",
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