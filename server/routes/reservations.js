const express = require("express");
const { Types } = require("mongoose");
const { Reservation } = require("../models");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireManager, async (req, res) => {
  const { from, to } = req.query;
  const filter = {};

  if (from) {
    filter.reservationTime = { ...(filter.reservationTime || {}), $gte: new Date(from) };
  }

  if (to) {
    filter.reservationTime = { ...(filter.reservationTime || {}), $lte: new Date(to) };
  }

  try {
    const reservations = await Reservation.find(filter)
      .sort({ reservationTime: 1 })
      .limit(200)
      .populate("customer", "firstName lastName email")
      .lean();
    res.json(reservations);
  } catch (error) {
    console.error("GET /api/reservations failed", error);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});

router.patch("/:id", requireManager, async (req, res) => {
  const { id } = req.params;
  const updates = {};

  if (req.body.status) {
    updates.status = req.body.status;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
    updates.notes = req.body.notes;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "No updates provided" });
  }

  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid reservation id" });
  }

  updates.updatedAt = new Date();

  try {
    const reservation = await Reservation.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.json(reservation);
  } catch (error) {
    console.error("PATCH /api/reservations/:id failed", error);
    res.status(500).json({ error: "Failed to update reservation" });
  }
});

module.exports = router;


