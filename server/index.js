const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const { connectMongo } = require("./db/pool");
const { authenticate } = require("./middleware/auth");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const authRoutes = require("./routes/auth");
const menuRoutes = require("./routes/menu");
const customerRoutes = require("./routes/customers");
const orderRoutes = require("./routes/orders");
const reservationRoutes = require("./routes/reservations");
const customerPortalRoutes = require("./routes/customerPortal");
const settingsRoutes = require("./routes/settings");
const userRoutes = require("./routes/users");

const app = express();

// Serve static files in production
app.use(express.static(path.join(__dirname, '..')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN ||
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
allowedOrigins.add("null");

const isLocalHost = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch (error) {
    return false;
  }
};

app.use(cookieParser());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || isLocalHost(origin)) {
        return callback(null, true);
      }

      console.warn(`Blocked CORS origin: ${origin}`);

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authenticate);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/customer-portal", customerPortalRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

const port = parseInt(process.env.PORT || "4000", 10);

connectMongo()
  .then(() => {
    app.listen(port, () => {
      console.log(`Delicato server listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });



