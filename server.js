<<<<<<< HEAD
// src/server.js (FINAL VERSION - WORKS LOCALLY AND ON VERCEL)

=======
>>>>>>> aae50f6aa5bc484c2a91c0de27b296021196b22f
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/database.js";
import { app } from "./app.js";

// Load environment variables reliably
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// Connect to the database
connectDB();

<<<<<<< HEAD
=======
// ✅ This logic is perfect:
// It only runs app.listen() when NOT on Vercel
>>>>>>> aae50f6aa5bc484c2a91c0de27b296021196b22f
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running locally at http://localhost:${PORT}`);
  });
}

<<<<<<< HEAD
=======
// ✅ This logic is also perfect:
// It exports the 'app' object, which is exactly what Vercel needs.
>>>>>>> aae50f6aa5bc484c2a91c0de27b296021196b22f
export default app;
