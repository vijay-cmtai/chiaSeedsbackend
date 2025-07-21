// your-project/backend/src/controllers/order.controller.js

import Razorpay from "razorpay";
import crypto from "crypto";
import axios from "axios";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { Shipment } from "../models/shipment.model.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const GST_RATE = 0.05;

/**
 * Shipping charge calculate karne ke liye function.
 * Yeh aapki requirement ko poora karta hai.
 * 1 item = 99
 * 2 items = 99 + (1 * 70) = 169
 * 3 items = 99 + (2 * 70) = 239
 * @param {number} totalQuantity - Cart mein sabhi products ki total quantity.
 * @returns {number} The calculated shipping charge.
 */
const calculateShippingCharge = (totalQuantity) => {
  if (totalQuantity <= 0) {
    return 0;
  }
  if (totalQuantity === 1) {
    return 99;
  }
  const baseCharge = 99;
  const additionalItemCharge = 70;
  return baseCharge + (totalQuantity - 1) * additionalItemCharge;
};

const createDelhiveryShipment = async (order, totalWeight) => {
  if (!process.env.DELIVERY_ONE_API_URL) {
    throw new Error("Delhivery API URL is not defined in .env file.");
  }
  const { shippingAddress } = order;
  const payload = {
    shipments: [
      {
        name: shippingAddress.fullName,
        add: shippingAddress.street,
        pin: shippingAddress.postalCode,
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: "India",
        phone: shippingAddress.phone,
        orderid: order._id.toString(),
        payment_mode: "Prepaid",
        total_amount: parseFloat(order.totalPrice) || 0,
        products_desc: order.orderItems
          .map((item) => item.name)
          .slice(0, 5)
          .join(", "),
        quantity: order.orderItems
          .reduce((sum, item) => sum + item.quantity, 0)
          .toString(),
        weight: totalWeight || 0.5,
      },
    ],
    pickup_location: { name: "home" },
  };
  const url = `${process.env.DELIVERY_ONE_API_URL}/api/cmu/push.json`;
  const formData = `format=json&data=${JSON.stringify(payload)}`;
  try {
    const res = await axios.post(url, formData, {
      headers: {
        Authorization: `Token ${process.env.DELIVERY_ONE_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const { success, packages, rmk } = res.data;
    if (success && packages && packages.length > 0) {
      return {
        success: true,
        trackingNumber: packages[0].waybill,
        status: packages[0].status,
      };
    } else {
      throw new Error(
        `Delhivery API returned failure: ${rmk || JSON.stringify(res.data)}`
      );
    }
  } catch (error) {
    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    throw new Error(`Courier API request failed: ${errorMessage}`);
  }
};

const cancelDelhiveryShipment = async (trackingNumber) => {
  if (!process.env.DELIVERY_ONE_API_URL) {
    console.error(
      "Delhivery API URL is not defined in .env file for cancellation."
    );
    return { success: false, message: "Delhivery API URL is not configured." };
  }
  const url = `${process.env.DELIVERY_ONE_API_URL}/api/p/edit/`;
  const formData = `data=${JSON.stringify({ waybill: trackingNumber, cancellation: "true" })}`;
  try {
    const res = await axios.post(url, formData, {
      headers: {
        Authorization: `Token ${process.env.DELIVERY_ONE_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return res.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    return {
      success: false,
      message: `Could not cancel shipment: ${errorMessage}`,
    };
  }
};

const initiateRazorpayRefund = async (paymentId, amountInPaisa) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amountInPaisa,
      speed: "normal",
      notes: { reason: "Order cancelled by customer or admin." },
    });
    return refund;
  } catch (error) {
    if (error.error?.description?.includes("already been fully refunded")) {
      return { status: "processed", id: "already_refunded" };
    }
    const errorMessage = error.error
      ? JSON.stringify(error.error)
      : error.message;
    throw new Error(`Refund failed: ${errorMessage}`);
  }
};

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { addressId, amount: frontendTotalAmount } = req.body;
  const userId = req.user._id;

  if (!addressId) throw new ApiError(400, "Shipping address ID is required.");
  if (!frontendTotalAmount || frontendTotalAmount <= 0) {
    throw new ApiError(400, "Invalid total amount provided.");
  }

  const user = await User.findById(userId).populate("cart.product");
  if (!user || !user.cart.length) {
    throw new ApiError(400, "Your cart is empty.");
  }

  let backendSubtotal = 0;
  let totalQuantity = 0;

  for (const item of user.cart) {
    if (!item.product) {
      await User.findByIdAndUpdate(userId, {
        $pull: { cart: { _id: item._id } },
      });
      continue;
    }
    if (item.product.stock < item.quantity) {
      throw new ApiError(400, `Not enough stock for ${item.product.name}.`);
    }
    backendSubtotal += item.product.price * item.quantity;
    totalQuantity += item.quantity;
  }

  const shippingCharge = calculateShippingCharge(totalQuantity);
  const backendGstAmount = (backendSubtotal + shippingCharge) * GST_RATE;
  const backendTotalAmount =
    backendSubtotal + shippingCharge + backendGstAmount;

  if (Math.abs(frontendTotalAmount - backendTotalAmount) > 1) {
    console.error(
      `Price Tampering Alert! Frontend: ${frontendTotalAmount}, Backend: ${backendTotalAmount}`
    );
    throw new ApiError(400, "Price mismatch. Please refresh and try again.");
  }

  const amountInPaise = Math.round(backendTotalAmount * 100);

  if (amountInPaise <= 0) {
    throw new ApiError(400, "Cart total is zero. Cannot proceed.");
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: crypto.randomBytes(10).toString("hex"),
  });

  if (!razorpayOrder) {
    throw new ApiError(500, "Failed to create Razorpay order.");
  }

  res.status(200).json(
    new ApiResponse(200, {
      orderId: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
      key: process.env.RAZORPAY_KEY_ID,
      addressId,
    })
  );
});

export const verifyPaymentAndPlaceOrder = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    addressId,
  } = req.body;
  const userId = req.user._id;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !addressId
  ) {
    throw new ApiError(400, "Missing payment or address details.");
  }

  const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign)
    .digest("hex");

  if (razorpay_signature !== expectedSign) {
    throw new ApiError(400, "Invalid payment signature.");
  }

  const user = await User.findById(userId)
    .populate({ path: "cart.product", select: "name price stock weight" })
    .populate("addresses");
  if (!user) throw new ApiError(404, "User not found.");

  const selectedAddress = user.addresses.id(addressId);
  if (!selectedAddress) throw new ApiError(404, "Selected address not found.");

  const shippingAddress = {
    fullName: selectedAddress.fullName,
    phone: selectedAddress.phone,
    street: selectedAddress.street,
    city: selectedAddress.city,
    state: selectedAddress.state,
    postalCode: selectedAddress.postalCode,
    country: selectedAddress.country || "India",
    type: selectedAddress.type || "Home",
  };

  let subtotal = 0;
  let totalWeight = 0;
  let totalQuantity = 0;
  const items = [];
  const stockOps = [];

  for (const item of user.cart) {
    if (!item.product || item.product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Item "${item.product?.name}" is unavailable or out of stock.`
      );
    }
    subtotal += item.product.price * item.quantity;
    totalWeight += (item.product.weight || 0.5) * item.quantity;
    totalQuantity += item.quantity;

    items.push({
      product: item.product._id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
    });
    stockOps.push({
      updateOne: {
        filter: { _id: item.product._id },
        update: { $inc: { stock: -item.quantity } },
      },
    });
  }

  if (!items.length) throw new ApiError(400, "Cart is empty.");

  const shippingCharge = calculateShippingCharge(totalQuantity);
  const gstAmount = (subtotal + shippingCharge) * GST_RATE;
  const finalTotalPrice = subtotal + shippingCharge + gstAmount;

  const newOrder = await Order.create({
    user: userId,
    orderItems: items,
    shippingAddress,
    totalPrice: finalTotalPrice,
    paymentId: razorpay_payment_id,
    razorpayOrderId: razorpay_order_id,
    paymentMethod: "Razorpay",
    orderStatus: "Paid",
  });

  try {
    const shipmentResult = await createDelhiveryShipment(newOrder, totalWeight);
    if (shipmentResult.success) {
      const shipment = await Shipment.create({
        orderId: newOrder._id,
        userId,
        trackingNumber: shipmentResult.trackingNumber,
        status: "PENDING",
        courier: "Delivery One",
        shippingAddress: newOrder.shippingAddress,
      });
      newOrder.orderStatus = "Processing";
      newOrder.shipmentDetails = {
        shipmentId: shipment._id,
        trackingNumber: shipmentResult.trackingNumber,
        courier: "Delivery One",
      };
      await newOrder.save({ validateBeforeSave: false });
    }
  } catch (err) {
    console.error(
      `Automatic shipment creation failed for Order ID: ${newOrder._id}. Error: ${err.message}`
    );
  }

  await Product.bulkWrite(stockOps);
  user.cart = [];
  await user.save({ validateBeforeSave: false });

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { order: newOrder },
        "Payment verified & order placed."
      )
    );
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const currentUser = req.user;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID format.");
  }

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");

  const isOwner = order.user.toString() === currentUser._id.toString();
  const isAdmin = currentUser.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You are not authorized to cancel this order.");
  }

  if (["Shipped", "Delivered", "Cancelled"].includes(order.orderStatus)) {
    throw new ApiError(
      400,
      `Cannot cancel order. Current status: ${order.orderStatus}`
    );
  }

  if (!order.paymentId) {
    order.orderStatus = "Cancelled";
    order.cancellationDetails = {
      cancelledBy: isAdmin ? "Admin" : "User",
      reason: "Cancelled, but refund failed due to missing payment details.",
      cancellationDate: new Date(),
    };
    await order.save({ validateBeforeSave: false });
    throw new ApiError(
      500,
      "Order cancelled, but refund failed. Please contact support."
    );
  }

  try {
    if (order.shipmentDetails?.trackingNumber) {
      await cancelDelhiveryShipment(order.shipmentDetails.trackingNumber);
    }

    const refundAmountInPaisa = Math.round(order.totalPrice * 100);
    const refund = await initiateRazorpayRefund(
      order.paymentId,
      refundAmountInPaisa
    );

    const stockUpdateOperations = order.orderItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: item.quantity } },
      },
    }));
    await Product.bulkWrite(stockUpdateOperations);

    order.orderStatus = "Cancelled";
    order.refundDetails = {
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      createdAt: new Date(),
    };
    order.cancellationDetails = {
      cancelledBy: isAdmin ? "Admin" : "User",
      reason: reason || "Cancelled by " + (isAdmin ? "Admin" : "User"),
      cancellationDate: new Date(),
    };

    const updatedOrder = await order.save({ validateBeforeSave: false });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedOrder,
          "Order has been cancelled. Refund initiated."
        )
      );
  } catch (error) {
    console.error("ERROR DURING CANCELLATION PROCESS:", error);
    throw new ApiError(500, `Order cancellation failed: ${error.message}`);
  }
});

export const retryShipment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw new ApiError(400, "Order ID is required for retry.");

  if (req.user.role !== "admin") {
    throw new ApiError(403, "Only admins can perform this action.");
  }

  const order = await Order.findById(orderId).populate(
    "orderItems.product",
    "weight"
  );
  if (!order) throw new ApiError(404, "Order not found.");

  if (order.orderStatus === "Shipped") {
    throw new ApiError(400, "This order is already shipped.");
  }

  const totalWeight = order.orderItems.reduce((acc, item) => {
    return acc + (item.product.weight || 0.5) * item.quantity;
  }, 0);

  try {
    const result = await createDelhiveryShipment(order, totalWeight);
    if (result.success) {
      const newShipment = await Shipment.create({
        orderId: order._id,
        userId: order.user,
        trackingNumber: result.trackingNumber,
        status: "PENDING",
        shippingAddress: order.shippingAddress,
        courier: "Delivery One",
      });
      order.orderStatus = "Processing";
      order.shipmentDetails = {
        shipmentId: newShipment._id,
        trackingNumber: result.trackingNumber,
        courier: "Delivery One",
      };
      await order.save({ validateBeforeSave: false });
      res
        .status(200)
        .json(new ApiResponse(200, order, "Shipment created successfully."));
    } else {
      throw new ApiError(500, "Delhivery shipment failed on retry.");
    }
  } catch (err) {
    throw new ApiError(500, `Retry failed: ${err.message}`);
  }
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("orderItems.product", "name mainImage")
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, orders, "User orders fetched successfully."));
});

export const getSingleOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID format.");
  }

  const order = await Order.findById(orderId).populate(
    "orderItems.product",
    "name mainImage price"
  );

  if (!order) {
    throw new ApiError(404, "Order not found.");
  }

  if (
    req.user.role !== "admin" &&
    order.user.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "You are not authorized to view this order.");
  }

  res
    .status(200)
    .json(new ApiResponse(200, order, "Order details fetched successfully."));
});
