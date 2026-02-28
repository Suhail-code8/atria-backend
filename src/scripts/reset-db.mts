import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/atria";

const resetDatabase = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    console.log("🗑️  Dropping the database...");
    await mongoose.connection.db?.dropDatabase();

    console.log("✅ Database successfully wiped. Your slate is clean!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    process.exit(1);
  }
};

resetDatabase();