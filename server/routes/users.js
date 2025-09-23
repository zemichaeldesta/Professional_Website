const express = require("express");
const { Types } = require("mongoose");
const { User } = require("../models");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

const SERIALIZABLE_FIELDS = ["_id", "name", "email", "role", "customer", "createdAt", "updatedAt"];

function serializeUser(user) {
  const record = SERIALIZABLE_FIELDS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(user, key)) {
      acc[key] = user[key];
    }
    return acc;
  }, {});

  return {
    id: String(record._id),
    name: record.name || "",
    email: record.email,
    role: record.role,
    customerId: record.customer ? String(record.customer) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

async function ensureAnotherManager(excludeId) {
  const filter = excludeId ? { role: "manager", _id: { $ne: excludeId } } : { role: "manager" };
  const remaining = await User.countDocuments(filter);
  return remaining > 0;
}

router.use(requireManager);

router.get("/", async (_req, res) => {
  try {
    const users = await User.find({}, SERIALIZABLE_FIELDS.join(" "))
      .sort({ role: 1, createdAt: 1 })
      .lean();
    res.json(users.map(serializeUser));
  } catch (error) {
    console.error("GET /api/users failed", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const updates = {};
  const { name, role } = req.body || {};
  const trimmedName = typeof name === "string" ? name.trim() : undefined;

  if (trimmedName !== undefined) {
    if (!trimmedName) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }
    updates.name = trimmedName;
  }

  if (role !== undefined) {
    const normalizedRole = String(role).toLowerCase();
    const allowedRoles = Array.isArray(User.ROLES) ? User.ROLES : ["manager", "staff", "customer"];
    const targetRole = normalizedRole === "employee" ? "staff" : normalizedRole;

    if (!allowedRoles.includes(targetRole)) {
      return res.status(400).json({ error: "Unsupported role" });
    }
    updates.role = targetRole;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    const current = await User.findById(id);
    if (!current) {
      return res.status(404).json({ error: "User not found" });
    }

    if (updates.role && current.role === "manager" && updates.role !== "manager") {
      const hasRemaining = await ensureAnotherManager(id);
      if (!hasRemaining) {
        return res.status(400).json({ error: "At least one manager must remain" });
      }
    }

    current.set(updates);
    const saved = await current.save();
    res.json(serializeUser(saved.toObject()));
  } catch (error) {
    console.error(`PATCH /api/users/${id} failed`, error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (req.user && String(req.user.id) === id) {
    return res.status(400).json({ error: "You cannot remove your own account" });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "manager") {
      const hasRemaining = await ensureAnotherManager(id);
      if (!hasRemaining) {
        return res.status(400).json({ error: "At least one manager must remain" });
      }
    }

    await User.deleteOne({ _id: id });
    res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/users/${id} failed`, error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
