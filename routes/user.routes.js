import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  getUserDashboardStats,
  getRecentUserOrders,
  getMyProfile,
  updateMyProfile,
  updateUserAvatar,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  placeOrder,
  getMyOrders,
  getSingleOrder,
  // Cart controllers ko import karein
  getCart,
  addToCart,
  removeFromCart,
  updateCartQuantity,
} from "../controllers/user.controller.js";

const router = Router();

// Apply auth middleware to all routes in this file
router.use(authMiddleware);

// --- Dashboard & Profile Routes ---
router.route("/dashboard").get(getUserDashboardStats);
router.route("/profile").get(getMyProfile).put(updateMyProfile);
router.route("/avatar").patch(upload.single("avatar"), updateUserAvatar);

// --- Address Routes ---
router.route("/addresses").get(getAddresses).post(addAddress);
router.route("/addresses/:addressId").put(updateAddress).delete(deleteAddress);

// --- Wishlist Routes ---
router.route("/wishlist").get(getWishlist).post(addToWishlist);
router.route("/wishlist/:productId").delete(removeFromWishlist);

// === NEW: Cart Routes ===
router.route("/cart").get(getCart).post(addToCart);
router
  .route("/cart/:productId")
  .delete(removeFromCart)
  .patch(updateCartQuantity);

// --- Orders Routes ---
router.route("/orders").get(getMyOrders).post(placeOrder);
router.route("/orders/recent").get(getRecentUserOrders);
router.route("/orders/:orderId").get(getSingleOrder);

export default router;
