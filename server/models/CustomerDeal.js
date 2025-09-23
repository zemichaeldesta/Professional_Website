const { Schema, model, Types } = require("mongoose");

const CustomerDealSchema = new Schema(
  {
    customer: { type: Types.ObjectId, ref: "Customer", required: true },
    deal: { type: Types.ObjectId, ref: "LoyaltyDeal", required: true },
    redeemedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

CustomerDealSchema.index({ customer: 1, deal: 1 }, { unique: true });

module.exports = model("CustomerDeal", CustomerDealSchema);
