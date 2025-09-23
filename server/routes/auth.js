const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Customer } = require("../models");
const { SESSION_COOKIE, TOKEN_AUDIENCE, TOKEN_ISSUER } = require("../middleware/auth");

const router = express.Router();

const DEFAULT_SESSION_TTL_SECONDS = parseInt(process.env.AUTH_TOKEN_TTL || "86400", 10);
const PERSISTENT_TTL_SECONDS = parseInt(process.env.AUTH_PERSIST_TTL || "2592000", 10);
const ALLOWED_ROLES = new Set(["manager", "staff", "customer"]);

function getCookieOptions(remember) {
  const secure = process.env.NODE_ENV === "production";
  const maxAge = (remember ? PERSISTENT_TTL_SECONDS : DEFAULT_SESSION_TTL_SECONDS) * 1000;
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge
  };
}

function buildTokenPayload(user) {
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name || user.email
  };

  if (user.customer) {
    payload.customerId = typeof user.customer === "string" ? user.customer : user.customer.toString();
  }

  return payload;
}

router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password, phone, remember } = req.body || {};

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "First name, last name, email, and password are required" });
  }

  if (String(password).trim().length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  if (!process.env.AUTH_SECRET) {
    return res.status(500).json({ error: "Auth secret not configured" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const existingCustomer = await Customer.findOne({ email: normalizedEmail }).lean();
    if (existingCustomer) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(String(password).trim(), 12);

    const customer = await Customer.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : undefined
    });

    let user;
    try {
      user = await User.create({
        email: normalizedEmail,
        passwordHash,
        role: "customer",
        name: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
        customer: customer._id
      });
    } catch (creationError) {
      await Customer.deleteOne({ _id: customer._id }).catch(() => {});
      throw creationError;
    }


    const payload = buildTokenPayload(user);
    const rememberFlag = Boolean(remember);
    const expiresIn = rememberFlag ? PERSISTENT_TTL_SECONDS : DEFAULT_SESSION_TTL_SECONDS;
    const token = jwt.sign(payload, process.env.AUTH_SECRET, {
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
      expiresIn
    });

    res.cookie(SESSION_COOKIE, token, getCookieOptions(rememberFlag));

    return res.status(201).json({
      user: payload,
      customer: {
        id: customer._id.toString(),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        loyaltyTier: customer.loyaltyTier,
        pointsBalance: customer.pointsBalance
      },
      expiresIn
    });
  } catch (error) {
    console.error("POST /api/auth/signup failed", error);
    return res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/signin", async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (!process.env.AUTH_SECRET) {
    return res.status(500).json({ error: "Auth secret not configured" });
  }

  try {
    const lookupEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: lookupEmail }).lean();
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!ALLOWED_ROLES.has(user.role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (user.role === "customer" && !user.customer) {
      return res.status(403).json({ error: "Customer account not configured" });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload = buildTokenPayload(user);
    const rememberFlag = Boolean(remember);
    const expiresIn = rememberFlag ? PERSISTENT_TTL_SECONDS : DEFAULT_SESSION_TTL_SECONDS;
    const token = jwt.sign(payload, process.env.AUTH_SECRET, {
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
      expiresIn
    });

    res.cookie(SESSION_COOKIE, token, getCookieOptions(rememberFlag));

    return res.json({
      user: payload,
      expiresIn
    });
  } catch (error) {
    console.error("POST /api/auth/signin failed", error);
    return res.status(500).json({ error: "Failed to sign in" });
  }
});

router.post("/signout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return res.json({ success: true });
});

router.get("/session", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({ user: req.user });
});

module.exports = router;


