const { Schema, model, Types } = require("mongoose");

const PaymentMethodSchema = new Schema(
  {
    customer: { type: Types.ObjectId, ref: "Customer", required: true },
    brand: { type: String },
    last4: { type: String },
    expiresMonth: { type: Number },
    expiresYear: { type: Number },
    providerToken: { type: String },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

PaymentMethodSchema.index({ customer: 1, isDefault: 1 });

module.exports = model("PaymentMethod", PaymentMethodSchema);
