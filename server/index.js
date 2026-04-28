const dotenv = require("dotenv");
const path = require("path");

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.join(__dirname, ".env") });
}

const connectDB = require("./src/config/db");
const app = require("./src/app");

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    try {
      await connectDB();
    } catch (dbError) {
      console.error("MongoDB connection failed:", dbError.message);
    }
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

start();
