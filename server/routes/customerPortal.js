const express = require("express");
const { Types } = require("mongoose");
const {
  Customer,
  Wallet,
  LoyaltyDeal,
  CustomerDeal,
  LoyaltyTransaction,
  Reservation,
  Order,
  PaymentMethod,
  MenuItem
} = require("../models");
const { requireCustomer } = require("../middleware/auth");

const router = express.Router();

const TIER_LADDER = [
  { tier: "Bronze", minPoints: 0, nextTier: "Silver", nextPoints: 5000 },
  { tier: "Silver", minPoints: 5000, nextTier: "Gold", nextPoints: 12000 },
  { tier: "Gold", minPoints: 12000, nextTier: "Platinum", nextPoints: 20000 },
  { tier: "Platinum", minPoints: 20000, nextTier: null, nextPoints: null }
];

function resolveTierProgress(tier, points) {
  const normalizedTier = typeof tier === "string" ? tier.toLowerCase() : "bronze";
  const entry =
    TIER_LADDER.find((tierEntry) => tierEntry.tier.toLowerCase() === normalizedTier) ||
    TIER_LADDER[0];

  const { minPoints, nextPoints, nextTier } = entry;
  if (!nextPoints) {
    return {
      currentTier: entry.tier,
      nextTier: null,
      progressPercent: 100,
      pointsToNext: 0
    };
  }

  const span = Math.max(1, nextPoints - minPoints);
  const progressPoints = Math.min(Math.max(0, points - minPoints), span);
  const progressPercent = Math.round((progressPoints / span) * 100);

  return {
    currentTier: entry.tier,
    nextTier,
    progressPercent,
    pointsToNext: Math.max(0, nextPoints - points)
  };
}

router.use(requireCustomer);

router.get("/dashboard", async (req, res) => {
  const { customerId } = req.user || {};

  if (!customerId || !Types.ObjectId.isValid(customerId)) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      customer,
      wallet,
      ordersThisMonth,
      reservations,
      recentOrders,
      loyaltyTransactions,
      activeDeals,
      redeemedDeals,
      paymentMethods,
      menuItems
    ] = await Promise.all([
      Customer.findById(customerId).lean(),
      Wallet.findOne({ customer: customerId }).lean(),
      Order.countDocuments({ customer: customerId, createdAt: { $gte: startOfMonth } }),
      Reservation.find({ customer: customerId, reservationTime: { $gte: now } })
        .sort({ reservationTime: 1 })
        .limit(3)
        .lean(),
      Order.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      LoyaltyTransaction.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      LoyaltyDeal.find({
        isActive: true,
        startsAt: { $lte: now },
        endsAt: { $gte: now }
      })
        .sort({ pointsRequired: 1 })
        .lean(),
      CustomerDeal.find({ customer: customerId }).lean(),
      PaymentMethod.find({ customer: customerId })
        .sort({ isDefault: -1, createdAt: 1 })
        .lean(),
      MenuItem.find({
        $or: [{ isActive: true }, { isActive: { $exists: false } }]
      })
        .sort({ sortOrder: 1, name: 1 })
        .limit(12)
        .lean()
    ]);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const loyaltySummary = resolveTierProgress(customer.loyaltyTier, customer.pointsBalance || 0);

    const summary = {
      id: customer._id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      loyaltyTier: customer.loyaltyTier,
      pointsBalance: customer.pointsBalance,
      tierExpiresAt: customer.tierExpiresAt,
      ordersThisMonth,
      nextReservationAt: reservations.length ? reservations[0].reservationTime : null
    };

    const walletPayload = wallet
      ? {
          balanceCents: wallet.balanceCents,
          autoReloadThresholdCents: wallet.autoReloadThresholdCents,
          autoReloadAmountCents: wallet.autoReloadAmountCents
        }
      : {
          balanceCents: 0,
          autoReloadThresholdCents: 0,
          autoReloadAmountCents: 0
        };

    const redeemedDealIds = new Set(
      redeemedDeals.map((deal) => deal.deal && deal.deal.toString()).filter(Boolean)
    );

    const deals = activeDeals.map((deal) => ({
      id: deal._id,
      title: deal.title,
      description: deal.description,
      pointsRequired: deal.pointsRequired,
      startsAt: deal.startsAt,
      endsAt: deal.endsAt,
      isRedeemed: redeemedDealIds.has(deal._id.toString())
    }));

    const payments = paymentMethods.map((method) => ({
      id: method._id,
      brand: method.brand,
      last4: method.last4,
      expiresMonth: method.expiresMonth,
      expiresYear: method.expiresYear,
      isDefault: Boolean(method.isDefault)
    }));

    const reservationsPayload = reservations.map((reservation) => ({
      id: reservation._id,
      reservationTime: reservation.reservationTime,
      partySize: reservation.partySize,
      status: reservation.status,
      notes: reservation.notes
    }));

    const ordersPayload = recentOrders.map((order) => ({
      id: order._id,
      createdAt: order.createdAt,
      status: order.status,
      channel: order.channel,
      totalCents: order.totalCents,
      items: (order.items || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents
      }))
    }));

    const loyaltyActivity = loyaltyTransactions.map((transaction) => ({
      id: transaction._id,
      pointsChange: transaction.pointsChange,
      description: transaction.description,
      createdAt: transaction.createdAt
    }));

    const menu = menuItems.map((item) => ({
      id: item._id,
      name: item.name,
      description: item.description,
      category: item.category,
      priceCents: item.priceCents,
      imageUrl: item.imageUrl
    }));

    return res.json({
      customer: summary,
      wallet: walletPayload,
      loyalty: {
        ...loyaltySummary,
        pointsBalance: customer.pointsBalance,
        tierExpiresAt: customer.tierExpiresAt
      },
      deals,
      payments,
      activity: {
        reservations: reservationsPayload,
        orders: ordersPayload,
        loyalty: loyaltyActivity
      },
      menu
    });
  } catch (error) {
    console.error("GET /api/customer-portal/dashboard failed", error);
    return res.status(500).json({ error: "Failed to load customer dashboard" });
  }
});

module.exports = router;
