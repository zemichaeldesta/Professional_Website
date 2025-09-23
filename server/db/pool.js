const mongoose = require("mongoose");

let connectionPromise;

async function connectMongo() {
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI in .env (Atlas URI required)");
  }

  const mongoOptions = {
    dbName: process.env.MONGODB_DB || undefined,
    maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE || "10", 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT || "8000", 10)
  };

  if (process.env.MONGO_DEBUG === "true") {
    mongoose.set("debug", true);
  }

  connectionPromise = mongoose
    .connect(uri, mongoOptions)
    .then((conn) => {
      console.log("MongoDB connected:", conn.connection.host);
      return conn;
    })
    .catch((err) => {
      connectionPromise = null;
      console.error("MongoDB connection error:", err.message);
      throw err;
    });

  return connectionPromise;
}

module.exports = {
  connectMongo,
  mongoose
};
