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

router.use(authMiddleware, adminMiddleware);

router.route("/dashboard").get(getAdminDashboardStats);
router.route("/sales-overview").get(getSalesOverview);

router.route("/orders/recent").get(getRecentAdminOrders);
router.route("/orders/:orderId/status").patch(updateOrderStatus);
router.route("/orders/all").get(getAllAdminOrders);

router
  .route("/products")
  .post(upload.array("images", 5), createProduct)
  .get(getAllProducts);

router
  .route("/products/:productId")
  .put(upload.array("images", 5), updateProduct)
  .delete(deleteProduct);

router.route("/users").get(getAllUsers);
router.route("/users/:userId").get(getUserDetails);
router.route("/users/:userId/orders").get(getUserOrders);

export default router;
