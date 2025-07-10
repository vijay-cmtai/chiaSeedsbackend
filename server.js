// src/server.js (FINAL AND GUARANTEED FIX)

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Configure dotenv with the absolute path to the .env file in the parent directory
dotenv.config({
  path: path.resolve(__dirname, "../.env"), // Goes one level up from 'src' to find '.env'
});

// Ab baaki files ko import karein
import connectDB from "./config/database.js";
import { app } from "./app.js";

// Ab MONGODB_URI yahan 100% available hoga
if (!process.env.MONGODB_URI) {
  console.error(
    "FATAL ERROR: MONGODB_URI is not defined. The server cannot start. Check the .env file path in server.js"
  );
  process.exit(1);
}

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });

    app.on("error", (error) => {
      console.error("EXPRESS APP ENCOUNTERED AN ERROR: ", error);
    });
  })
  .catch((err) => {
    console.error("MONGO DB connection failed! Server will not start.", err);
    process.exit(1);
  });
