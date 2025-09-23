const express = require("express");
const { Types } = require("mongoose");
const {
  Customer,
  Wallet,
  Order,
  Reservation,
  LoyaltyDeal,
  CustomerDeal,
  LoyaltyTransaction
} = require("../models");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

router.use(requireManager);

function isValidId(value) {
  return Types.ObjectId.isValid(value);
}

router.get("/:id/summary", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  try {
    const customer = await Customer.findById(id).lean();
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const [wallet, ordersThisMonth, nextReservation] = await Promise.all([
      Wallet.findOne({ customer: id }).lean(),
      Order.countDocuments({
        customer: id,
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }),
      Reservation.findOne({ customer: id, reservationTime: { $gte: new Date() } })
        .sort({ reservationTime: 1 })
        .lean()
    ]);

    res.json({
      id: customer._id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      loyaltyTier: customer.loyaltyTier,
      pointsBalance: customer.pointsBalance,
      tierExpiresAt: customer.tierExpiresAt,
      walletBalanceCents: wallet ? wallet.balanceCents : 0,
      ordersThisMonth,
      nextReservationAt: nextReservation ? nextReservation.reservationTime : null
    });
  } catch (error) {
    console.error("GET /api/customers/:id/summary failed", error);
    res.status(500).json({ error: "Failed to fetch customer summary" });
  }
});

router.get("/:id/deals", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  try {
    const now = new Date();
    const deals = await LoyaltyDeal.find({
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now }
    })
      .sort({ pointsRequired: 1 })
      .lean();

    const redeemed = await CustomerDeal.find({ customer: id }).lean();
    const redeemedIds = new Set(redeemed.map((deal) => deal.deal.toString()));

    res.json(
      deals.map((deal) => ({
        ...deal,
        isRedeemed: redeemedIds.has(deal._id.toString())
      }))
    );
  } catch (error) {
    console.error("GET /api/customers/:id/deals failed", error);
    res.status(500).json({ error: "Failed to fetch customer deals" });
  }
});

router.get("/:id/activity", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  try {
    const now = new Date();
    const [reservations, orders, points] = await Promise.all([
      Reservation.find({ customer: id, reservationTime: { $gte: now } })
        .sort({ reservationTime: 1 })
        .limit(5)
        .lean(),
      Order.find({ customer: id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      LoyaltyTransaction.find({ customer: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    res.json({ reservations, orders, points });
  } catch (error) {
    console.error("GET /api/customers/:id/activity failed", error);
    res.status(500).json({ error: "Failed to fetch customer activity" });
  }
});

module.exports = router;
