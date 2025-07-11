// src/app.js (Full Code with Verification Log)

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mainRouter from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();
console.log(
  `[CORS Verification] The server is about to configure CORS for origin: ${process.env.CORS_ORIGIN}`
);
app.use(
  cors({
     origin: ["http://localhost:3036","https://chiaseedsfront.vercel.app", "https://www.naraaglobal.com"],
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// API Routes
app.use("/api/v1", mainRouter);
app.use(errorHandler);

export { app };
