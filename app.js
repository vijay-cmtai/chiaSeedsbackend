
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
<<<<<<< HEAD
    origin:"http://localhost:3036", 
=======
     origin: ["http://localhost:3036","https://chiaseedsfront.vercel.app", "https://www.naraaglobal.com"],
>>>>>>> aae50f6aa5bc484c2a91c0de27b296021196b22f
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use("/api/v1", mainRouter);
app.use(errorHandler);
<<<<<<< HEAD
export { app };
=======

export { app };
>>>>>>> aae50f6aa5bc484c2a91c0de27b296021196b22f
