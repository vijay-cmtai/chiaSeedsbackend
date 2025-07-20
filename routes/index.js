import { Router } from "express";
import authRouter from "./auth.routes.js";
import userRouter from "./user.routes.js";
import adminRouter from "./admin.routes.js";
import productRouter from "./product.routes.js";
import paymentRouter from "./payment.routes.js";
import trackingRouter from "./tracking.routes.js";
import contactRouter from "./contact.routes.js";

const router = Router();
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/admin", adminRouter);
router.use("/product", productRouter);
router.use("/payment", paymentRouter);
router.use("/track", trackingRouter);
router.use("/contact", contactRouter);

export default router;
