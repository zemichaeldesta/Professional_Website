const { Schema, model, Types } = require("mongoose");

const LoyaltyTransactionSchema = new Schema(
  {
    customer: { type: Types.ObjectId, ref: "Customer", required: true },
    pointsChange: { type: Number, required: true },
    description: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = model("LoyaltyTransaction", LoyaltyTransactionSchema);
