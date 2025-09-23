const express = require("express");
const { Setting } = require("../models");
const { requireManager } = require("../middleware/auth");

const router = express.Router();

const DEFAULT_POINTS_PER_DOLLAR = (() => {
  const envValue = Number.parseFloat(process.env.LOYALTY_POINTS_PER_DOLLAR);
  if (Number.isFinite(envValue) && envValue >= 0) {
    return envValue;
  }
  return 1;
})();

async function resolvePointsPerDollar() {
  try {
    const record = await Setting.findOne({ key: "loyalty.pointsPerDollar" }).lean();
    if (!record || record.value === undefined || record.value === null) {
      return DEFAULT_POINTS_PER_DOLLAR;
    }

    const numeric = Number(record.value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
    return DEFAULT_POINTS_PER_DOLLAR;
  } catch (error) {
    console.error("Failed to resolve points per dollar", error);
    return DEFAULT_POINTS_PER_DOLLAR;
  }
}

router.use(requireManager);

router.get("/loyalty", async (_req, res) => {
  const pointsPerDollar = await resolvePointsPerDollar();
  res.json({ pointsPerDollar });
});

router.put("/loyalty", async (req, res) => {
  const { pointsPerDollar } = req.body || {};
  const numeric = Number.parseFloat(pointsPerDollar);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1000) {
    return res.status(400).json({ error: "Points per dollar must be between 0 and 1000." });
  }

  try {
    const updatePayload = {
      key: "loyalty.pointsPerDollar",
      value: numeric
    };

    if (req.user && req.user.id) {
      updatePayload.updatedBy = req.user.id;
    }

    const updated = await Setting.findOneAndUpdate(
      { key: "loyalty.pointsPerDollar" },
      updatePayload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    res.json({
      pointsPerDollar: updated.value,
      updatedAt: updated.updatedAt
    });
  } catch (error) {
    console.error("PUT /api/settings/loyalty failed", error);
    res.status(500).json({ error: "Failed to update loyalty settings" });
  }
});

module.exports = router;



