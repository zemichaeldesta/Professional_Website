const { Schema, model } = require("mongoose");

const MenuItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    category: { type: String, trim: true },
    priceCents: { type: Number, required: true },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number }
  },
  { timestamps: true }
);

module.exports = model("MenuItem", MenuItemSchema);
