const { Schema, model } = require("mongoose");

const CustomerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    loyaltyTier: { type: String, default: "Bronze" },
    pointsBalance: { type: Number, default: 0 },
    tierExpiresAt: { type: Date }
  },
  { timestamps: true }
);

CustomerSchema.virtual("fullName").get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

module.exports = model("Customer", CustomerSchema);
