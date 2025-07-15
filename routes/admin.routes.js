
import { Router } from "express";
import {
  getAdminDashboardStats,
  getRecentAdminOrders,
  getSalesOverview,
  updateOrderStatus,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getAllUsers,
  getUserDetails,
  getUserOrders,
  getAllAdminOrders,
} from "../controllers/admin.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { adminMiddleware } from "../middlewares/admin.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Middleware har admin route ke liye
router.use(authMiddleware, adminMiddleware);

// Dashboard routes
router.route("/dashboard").get(getAdminDashboardStats);
router.route("/sales-overview").get(getSalesOverview);

// Order routes
router.route("/orders/recent").get(getRecentAdminOrders);
router.route("/orders/:orderId/status").patch(updateOrderStatus);
router.route("/orders/all").get(getAllAdminOrders);

// Product routes
router
  .route("/products")
  .post(upload.array("images", 5), createProduct)
  .get(getAllProducts);

// Yeh route ab controller se match kar raha hai
router.route("/products/:productId").put(updateProduct).delete(deleteProduct);

// User routes
router.route("/users").get(getAllUsers);
// User ke routes ko bhi theek kar dete hain (best practice)
router.route("/users/:userId").get(getUserDetails);
router.route("/users/:userId/orders").get(getUserOrders);

export default router;
