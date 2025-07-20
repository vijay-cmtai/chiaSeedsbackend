import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { uploadOnCloudinary } from "../config/cloudinary.js";
import mongoose from "mongoose";

const getAdminDashboardStats = asyncHandler(async (req, res) => {
  const [totalSalesData, newOrdersCount, activeUsersCount] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: "Completed" } },
      { $group: { _id: null, totalSales: { $sum: "$totalPrice" } } },
    ]),
    Order.countDocuments({ orderStatus: { $in: ["Pending", "Processing"] } }),
    User.countDocuments({ role: "user" }),
  ]);
  const stats = {
    totalSales: totalSalesData[0]?.totalSales || 0,
    newOrders: newOrdersCount,
    activeUsers: activeUsersCount,
  };
  return res
    .status(200)
    .json(new ApiResponse(200, stats, "Admin dashboard data fetched"));
});

const getSalesOverview = asyncHandler(async (req, res) => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: twelveMonthsAgo },
        orderStatus: "Completed",
      },
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        sales: { $sum: "$totalPrice" },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthlySales = Array.from({ length: 12 }, (_, i) => ({
    name: monthNames[i],
    sales: 0,
  }));
  salesData.forEach((item) => {
    monthlySales[item._id.month - 1].sales = item.sales;
  });
  return res
    .status(200)
    .json(new ApiResponse(200, monthlySales, "Monthly sales overview fetched"));
});

const getRecentAdminOrders = asyncHandler(async (req, res) => {
  const recentOrders = await Order.find({})
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(3)
    .select("user totalPrice orderStatus")
    .lean();
  return res
    .status(200)
    .json(new ApiResponse(200, recentOrders, "Recent admin orders fetched"));
});

const createProduct = asyncHandler(async (req, res) => {
  const {
    name, description, price, originalPrice, stock, category,
    packagingType, seedType, speciality, weight, length, breadth, height,
  } = req.body;

  const requiredFields = [
    name, description, price, originalPrice, stock, category,
    packagingType, seedType, speciality, weight, length, breadth, height,
  ];
  if (requiredFields.some((f) => f === undefined || String(f).trim() === "")) {
    throw new ApiError(400, "All product fields are required");
  }

  const imageLocalPaths = req.files?.map((file) => file.path);
  if (!imageLocalPaths || imageLocalPaths.length === 0) {
    throw new ApiError(400, "At least one product image is required");
  }

  const uploadPromises = imageLocalPaths.map((path) =>
    uploadOnCloudinary(path)
  );
  const uploadResults = await Promise.all(uploadPromises);
  const imageUrls = uploadResults.map((result) => result?.url).filter(Boolean);
  if (imageUrls.length !== imageLocalPaths.length) {
    throw new ApiError(500, "Failed to upload one or more images");
  }

  const product = await Product.create({
    name,
    description,
    price: parseFloat(price),
    originalPrice: parseFloat(originalPrice),
    stock: parseInt(stock, 10),
    category,
    packagingType,
    seedType,
    speciality,
    weight: parseFloat(weight),
    dimensions: {
      length: parseFloat(length),
      breadth: parseFloat(breadth),
      height: parseFloat(height),
    },
    images: imageUrls,
    mainImage: imageUrls[0],
  });

  if (!product) {
    throw new ApiError(500, "Something went wrong while creating the product");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, product, "Product created successfully"));
});

const updateProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }

  const {
    name, description, price, originalPrice, stock, category,
    packagingType, seedType, speciality, weight, length, breadth, height,
  } = req.body;
  
  const updateData = {
    name, description, price, originalPrice, stock, category,
    packagingType, seedType, speciality, weight,
    dimensions: { length, breadth, height },
  };

  if (req.files && req.files.length > 0) {
    const imageLocalPaths = req.files.map((file) => file.path);
    
    const uploadPromises = imageLocalPaths.map((path) => uploadOnCloudinary(path));
    const uploadResults = await Promise.all(uploadPromises);
    const newImageUrls = uploadResults.map((result) => result?.url).filter(Boolean);

    if (newImageUrls.length !== imageLocalPaths.length) {
      throw new ApiError(500, "Failed to upload one or more new images");
    }

    updateData.images = newImageUrls;
    updateData.mainImage = newImageUrls[0];
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, product, "Product updated successfully"));
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, "Invalid product ID");
  }
  const product = await Product.findByIdAndDelete(productId);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Product deleted successfully"));
});

const getAllProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({});
  return res
    .status(200)
    .json(new ApiResponse(200, products, "All products fetched"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: "user" }).select(
    "-password -otp -refreshToken -forgotPasswordToken"
  );
  return res
    .status(200)
    .json(new ApiResponse(200, users, "All users fetched successfully"));
});

const getUserDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
  const user = await User.findById(userId).select(
    "-password -otp -refreshToken -forgotPasswordToken"
  );
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User details fetched successfully"));
});

const getUserOrders = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
  const orders = await Order.find({ user: userId }).populate(
    "orderItems.product",
    "name price"
  );
  return res
    .status(200)
    .json(new ApiResponse(200, orders, `Orders for user fetched successfully`));
});

const getAllAdminOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({})
    .populate("user", "name")
    .sort({ createdAt: -1 });
  return res
    .status(200)
    .json(new ApiResponse(200, orders, "All orders fetched"));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid Order ID");
  }
  const validStatuses = [
    "Pending", "Processing", "Shipped", "Delivered", "Cancelled",
  ];
  if (!status || !validStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Must be one of: ${validStatuses.join(", ")}`
    );
  }
  const order = await Order.findByIdAndUpdate(
    orderId,
    { $set: { orderStatus: status } },
    { new: true }
  ).populate("user", "name");
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, order, "Order status updated successfully"));
});

export {
  getAdminDashboardStats,
  getSalesOverview,
  getRecentAdminOrders,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getAllUsers,
  getUserDetails,
  getUserOrders,
  updateOrderStatus,
  getAllAdminOrders,
};
