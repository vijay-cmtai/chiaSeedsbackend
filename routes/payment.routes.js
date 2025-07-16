import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  createRazorpayOrder,
  verifyPaymentAndPlaceOrder,
  cancelOrder,
} from "../controllers/payment.controller.js";

const router = Router();

router.use(authMiddleware);

router.route("/create-order").post(createRazorpayOrder);

router.route("/verify").post(verifyPaymentAndPlaceOrder);

router.route("/:orderId/cancel").patch(cancelOrder);

export default router;
