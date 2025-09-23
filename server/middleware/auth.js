const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "delicato_session";
const TOKEN_AUDIENCE = "delicato-app";
const TOKEN_ISSUER = "delicato-app";

function authenticate(req, _res, next) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    req.user = null;
    return next();
  }

  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, secret, {
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER
    });
    req.user = payload;
  } catch (error) {
    console.warn("Invalid auth token", error.message);
    req.user = null;
  }

  return next();
}

function requireManager(req, res, next) {
  if (req.user && req.user.role === "manager") {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

function requireCustomer(req, res, next) {
  if (req.user && req.user.role === "customer" && req.user.customerId) {
    return next();
  }
  return res.status(401).json({ error: "Customer authentication required" });
}

module.exports = {
  authenticate,
  requireManager,
  requireCustomer,
  SESSION_COOKIE,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER
};
