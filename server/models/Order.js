const { Schema, model, Types } = require("mongoose");

const OrderItemSchema = new Schema(
  {
    menuItem: { type: Types.ObjectId, ref: "MenuItem" },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPriceCents: { type: Number, required: true },
    specialInstructions: { type: String }
  },
  { _id: false }
);

const OrderContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    notes: { type: String }
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    customer: { type: Types.ObjectId, ref: "Customer" },
    contact: { type: OrderContactSchema },
    tableNumber: { type: String, trim: true },
    totalCents: { type: Number, required: true },
    status: { type: String, default: "pending", index: true },
    channel: { type: String, default: "dine_in" },
    items: { type: [OrderItemSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = model("Order", OrderSchema);
