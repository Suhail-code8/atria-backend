import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/atria";

const cleanDatabaseExceptUsers = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    // List all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    console.log(`🔍 Found ${collectionNames.length} collections: ${collectionNames.join(", ")}`);

    for (const name of collectionNames) {
      if (name === "users") {
        console.log(`⏩ Skipping 'users' collection...`);
        continue;
      }

      console.log(`🗑️  Dropping '${name}'...`);
      try {
        await db.collection(name).drop();
      } catch (dropError: any) {
        // Handle case where collection might have been deleted concurrently or other issues
        console.warn(`⚠️  Failed to drop '${name}': ${dropError.message}`);
      }
    }

    console.log("✅ Cleanup complete! All collections except 'users' have been removed.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
    process.exit(1);
  }
};

cleanDatabaseExceptUsers();
