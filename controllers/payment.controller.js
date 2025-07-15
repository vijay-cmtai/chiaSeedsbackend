import Razorpay from "razorpay";
import crypto from "crypto";
import axios from "axios";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { Shipment } from "../models/shipment.model.js";

// Razorpay client setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- CREATE DELHIVERY SHIPMENT ---
const createDelhiveryShipment = async (order, totalWeight) => {
  const { shippingAddress } = order;

  const requiredFields = [
    "fullName",
    "street",
    "city",
    "state",
    "postalCode",
    "phone",
  ];
  for (const field of requiredFields) {
    if (!shippingAddress[field]) {
      throw new ApiError(
        400,
        `Shipment creation failed. Missing address field: '${field}'`
      );
    }
  }

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
    pickup_location: {
      name: "home",
    },
  };

  const url = `${process.env.DELIVERY_ONE_API_URL}/api/cmu/push.json`;
  const formData = `format=json&data=${JSON.stringify(payload)}`;

  console.log("📦 Delhivery Shipment Request:", payload);

  try {
    const res = await axios.post(url, formData, {
      headers: {
        Authorization: `Token ${process.env.DELIVERY_ONE_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const { success, packages, rmk } = res.data;
    console.log("✅ Delhivery API Response:", res.data);

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
    console.error("❌ Delhivery API Error:", errorMessage);
    throw new Error(`Courier API request failed: ${errorMessage}`);
  }
};

// --- CREATE RAZORPAY ORDER ---
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { addressId } = req.body;
  const userId = req.user._id;

  if (!addressId) throw new ApiError(400, "Shipping address ID is required.");

  const user = await User.findById(userId).populate("cart.product");
  if (!user || !user.cart.length)
    throw new ApiError(400, "Your cart is empty.");

  let total = 0;
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
    total += item.product.price * item.quantity;
  }

  if (total <= 0)
    throw new ApiError(400, "Cart total is zero. Cannot proceed.");

  const razorpayOrder = await razorpay.orders.create({
    amount: total * 100,
    currency: "INR",
    receipt: crypto.randomBytes(10).toString("hex"),
  });

  if (!razorpayOrder)
    throw new ApiError(500, "Failed to create Razorpay order.");

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

// --- VERIFY PAYMENT & PLACE ORDER ---
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
    .populate({
      path: "cart.product",
      select: "name price stock weight",
    })
    .populate("addresses");

  if (!user) throw new ApiError(404, "User not found.");

  const selectedAddress = user.addresses.id(addressId);
  if (!selectedAddress)
    throw new ApiError(404, "Selected address not found.");

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

  let totalPrice = 0;
  let totalWeight = 0;
  const items = [];
  const stockOps = [];

  for (const item of user.cart) {
    if (!item.product || item.product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Item "${item.product?.name}" is unavailable or out of stock.`
      );
    }

    totalPrice += item.product.price * item.quantity;
    totalWeight += (item.product.weight || 0.5) * item.quantity;

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

  const newOrder = await Order.create({
    user: userId,
    orderItems: items,
    shippingAddress,
    totalPrice,
    paymentId: razorpay_payment_id,
    razorpayOrderId: razorpay_order_id,
    paymentMethod: "Razorpay",
    orderStatus: "Paid",
  });

  let shipmentDetails = { error: null };
  try {
    const shipmentResult = await createDelhiveryShipment(newOrder, totalWeight);
    if (shipmentResult.success) {
      const shipment = await Shipment.create({
        orderId: newOrder._id,
        userId,
        trackingNumber: shipmentResult.trackingNumber,
        status: shipmentResult.status,
        courier: "Delhivery",
      });

      newOrder.orderStatus = "Shipped";
      newOrder.shipmentDetails = {
        shipmentId: shipment._id,
        trackingNumber: shipmentResult.trackingNumber,
        courier: "Delhivery",
      };
      await newOrder.save({ validateBeforeSave: false });
      shipmentDetails = newOrder.shipmentDetails;
    }
  } catch (err) {
    console.error(
      `🚨 Automatic shipment creation failed for Order ID: ${newOrder._id}. Error: ${err.message}`
    );
    shipmentDetails.error = err.message;
  }

  await Product.bulkWrite(stockOps);
  user.cart = [];
  await user.save({ validateBeforeSave: false });

  res.status(201).json(
    new ApiResponse(
      201,
      { order: newOrder.toObject(), shipmentDetails },
      "Payment verified & order placed."
    )
  );
});

// --- RETRY SHIPMENT MANUALLY ---
export const retryShipment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId)
    throw new ApiError(400, "Order ID is required for retry.");

  const order = await Order.findById(orderId).populate(
    "orderItems.product",
    "weight"
  );
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.orderStatus === "Shipped")
    throw new ApiError(400, "This order is already shipped.");

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
        status: result.status,
        shippingAddress: order.shippingAddress,
        courier: "Delhivery",
      });

      order.orderStatus = "Shipped";
      order.shipmentDetails = {
        shipmentId: newShipment._id,
        trackingNumber: result.trackingNumber,
        courier: "Delhivery",
      };
      await order.save({ validateBeforeSave: false });

      res
        .status(200)
        .json(new ApiResponse(200, order, "Shipment created successfully."));
    } else {
      throw new ApiError(500, "Delhivery shipment failed.");
    }
  } catch (err) {
    console.error(`❌ Retry shipment failed:`, err.message);
    throw new ApiError(500, `Retry failed: ${err.message}`);
  }
});
