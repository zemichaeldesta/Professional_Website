const { Schema, model } = require("mongoose");

const LoyaltyDealSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    pointsRequired: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = model("LoyaltyDeal", LoyaltyDealSchema);
