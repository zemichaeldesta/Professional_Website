const { Schema, model, Types } = require("mongoose");

const WalletSchema = new Schema(
  {
    customer: { type: Types.ObjectId, ref: "Customer", unique: true, required: true },
    balanceCents: { type: Number, default: 0 },
    autoReloadThresholdCents: { type: Number, default: 5000 },
    autoReloadAmountCents: { type: Number, default: 5000 }
  },
  { timestamps: true }
);

module.exports = model("Wallet", WalletSchema);
