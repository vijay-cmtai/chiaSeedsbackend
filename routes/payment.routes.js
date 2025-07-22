// your-project/backend/src/routes/payment.routes.js

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createRazorpayOrder,
  verifyPaymentAndPlaceOrder,
  cancelOrder,
  getMyOrders,
  getSingleOrderDetails,
  retryShipment,
  getPriceBreakdown, // Naye function ko import karein
} from "../controllers/payment.controller.js";

const router = Router();

router.use(authMiddleware);

// YEH HAI NAYA ROUTE
router.route("/price-breakdown").post(getPriceBreakdown);

router.route("/create-order").post(createRazorpayOrder);

router.route("/verify").post(verifyPaymentAndPlaceOrder);

router.route("/my-orders").get(getMyOrders);

router.route("/retry-shipment").post(retryShipment);

router.route("/:orderId").get(getSingleOrderDetails);

router.route("/:orderId/cancel").patch(cancelOrder);

export default router;
