import mongoose from "mongoose";

// Prefer env var; fall back to local Mongo instance with no auth.
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/collabcar";

if (!MONGODB_URI) {
  throw new Error("Please set the MONGODB_URI environment variable.");
}

export async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
  } catch (error) {
    console.error("Failed to connect to MongoDB. Ensure the database is running and MONGODB_URI is correct.");
    throw error;
  }
}
