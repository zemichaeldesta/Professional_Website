const express = require("express");
const { Types } = require("mongoose");
const { MenuItem } = require("../models");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

function isTruthy(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(normalized);
  }
  return Boolean(value);
}

router.get("/", async (req, res) => {
  try {
    const includeAll = req.query.include === "all";
    if (includeAll && (!req.user || req.user.role !== "manager")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const filter = includeAll
      ? {}
      : {
          $or: [{ isActive: true }, { isActive: { $exists: false } }]
        };

    const items = await MenuItem.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json(items);
  } catch (error) {
    console.error("GET /api/menu failed", error);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

router.post("/", requireManager, async (req, res) => {
  const { name, description, priceCents, category, imageUrl, sortOrder, isActive } = req.body;

  if (!name || typeof priceCents !== "number") {
    return res.status(400).json({ error: "Name and numeric priceCents are required" });
  }

  try {
    const item = await MenuItem.create({
      name,
      description,
      priceCents,
      category,
      imageUrl,
      sortOrder,
      isActive
    });
    res.status(201).json(item);
  } catch (error) {
    console.error("POST /api/menu failed", error);
    res.status(500).json({ error: "Failed to create menu item" });
  }
});

router.patch("/:id", requireManager, async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid menu item id" });
  }

  const updates = {};

  if (typeof req.body.name === "string" && req.body.name.trim()) {
    updates.name = req.body.name.trim();
  }

  if (typeof req.body.description === "string") {
    updates.description = req.body.description.trim();
  }

  if (typeof req.body.category === "string") {
    updates.category = req.body.category.trim();
  }

  if (typeof req.body.imageUrl === "string") {
    updates.imageUrl = req.body.imageUrl.trim();
  }

  if (typeof req.body.priceCents !== "undefined") {
    const nextPrice = Number(req.body.priceCents);
    if (!Number.isFinite(nextPrice)) {
      return res.status(400).json({ error: "priceCents must be numeric" });
    }
    updates.priceCents = Math.max(0, Math.round(nextPrice));
  }

  if (typeof req.body.sortOrder !== "undefined") {
    const nextSort = Number(req.body.sortOrder);
    if (!Number.isFinite(nextSort)) {
      return res.status(400).json({ error: "sortOrder must be numeric" });
    }
    updates.sortOrder = Math.round(nextSort);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
    updates.isActive = isTruthy(req.body.isActive);
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "No valid updates provided" });
  }

  updates.updatedAt = new Date();

  try {
    const updated = await MenuItem.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error(`PATCH /api/menu/${id} failed`, error);
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

router.delete("/:id", requireManager, async (req, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid menu item id" });
  }

  try {
    const deleted = await MenuItem.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/menu/${id} failed`, error);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
});

module.exports = router;
