const express = require("express");
const { Types } = require("mongoose");
const { Order, Customer, LoyaltyTransaction, Setting } = require("../models");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

const DEFAULT_POINTS_PER_DOLLAR = (() => {
  const envValue = Number.parseFloat(process.env.LOYALTY_POINTS_PER_DOLLAR);
  if (Number.isFinite(envValue) && envValue >= 0) {
    return envValue;
  }
  return 1;
})();

async function getPointsPerDollar() {
  try {
    const record = await Setting.findOne({ key: "loyalty.pointsPerDollar" }).lean();
    if (!record || record.value === undefined || record.value === null) {
      return DEFAULT_POINTS_PER_DOLLAR;
    }
    const numeric = Number(record.value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  } catch (error) {
    console.error("Failed to read loyalty points setting", error);
  }
  return DEFAULT_POINTS_PER_DOLLAR;
}


router.get("/", requireManager, async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) {
    filter.status = status;
  }

  try {
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("customer", "firstName lastName email")
      .lean();
    res.json(orders);
  } catch (error) {
    console.error("GET /api/orders failed", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.post("/", async (req, res) => {
  const { items, customerId, contact, tableNumber, channel } = req.body;
  const sessionCustomerId = req.user && req.user.role === "customer" ? req.user.customerId : null;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one item is required" });
  }

  const normalizedItems = [];

  for (const item of items) {
    const { menuItem, name, quantity = 1, unitPriceCents, specialInstructions } = item || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Each item requires a name" });
    }

    if (!Number.isFinite(unitPriceCents)) {
      return res.status(400).json({ error: "Each item requires a numeric unitPriceCents" });
    }

    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;

    normalizedItems.push({
      menuItem: menuItem && Types.ObjectId.isValid(menuItem) ? menuItem : undefined,
      name,
      quantity: safeQuantity,
      unitPriceCents: Math.floor(unitPriceCents),
      specialInstructions
    });
  }

  const totalCents = normalizedItems.reduce(
    (sum, current) => sum + current.quantity * current.unitPriceCents,
    0
  );

  if (totalCents <= 0) {
    return res.status(400).json({ error: "Order total must be greater than zero" });
  }

  const resolvedChannel = channel || (sessionCustomerId ? "guest_portal" : "web");

  const orderPayload = {
    items: normalizedItems,
    totalCents,
    channel: resolvedChannel,
    status: "pending"
  };

  if (tableNumber) {
    orderPayload.tableNumber = tableNumber;
  }

  const resolvedCustomerId = customerId || sessionCustomerId;

  if (resolvedCustomerId) {
    if (!Types.ObjectId.isValid(resolvedCustomerId)) {
      return res.status(400).json({ error: "Invalid customer id" });
    }
    orderPayload.customer = resolvedCustomerId;
  }

  if (contact && (contact.name || contact.email || contact.phone || contact.notes)) {
    orderPayload.contact = {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      notes: contact.notes
    };
  }

  try {
    const createdOrder = await Order.create(orderPayload);

    let pointsAwarded = 0;
    let updatedCustomer = null;

    if (orderPayload.customer && totalCents > 0) {
      const pointsPerDollar = await getPointsPerDollar();
      if (pointsPerDollar > 0) {
        pointsAwarded = Math.floor((totalCents / 100) * pointsPerDollar);
      }

      if (pointsAwarded > 0) {
        try {
          updatedCustomer = await Customer.findByIdAndUpdate(
            orderPayload.customer,
            { $inc: { pointsBalance: pointsAwarded } },
            { new: true }
          ).lean();

          if (updatedCustomer) {
            await LoyaltyTransaction.create({
              customer: orderPayload.customer,
              pointsChange: pointsAwarded,
              description: `Points earned from order ${createdOrder._id}`
            });
          } else {
            console.warn(
              "Order created but customer record missing for loyalty update",
              orderPayload.customer
            );
          }
        } catch (loyaltyError) {
          console.error("Failed to apply loyalty points", loyaltyError);
        }
      }
    }

    const responsePayload = createdOrder.toObject ? createdOrder.toObject() : createdOrder;
    if (pointsAwarded > 0 && updatedCustomer) {
      responsePayload.loyalty = {
        pointsAwarded,
        pointsBalance: updatedCustomer.pointsBalance
      };
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    console.error("POST /api/orders failed", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.patch("/:id/status", requireManager, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("PATCH /api/orders/:id/status failed", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

module.exports = router;



