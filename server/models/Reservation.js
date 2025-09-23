const { Schema, model, Types } = require("mongoose");

const ReservationSchema = new Schema(
  {
    customer: { type: Types.ObjectId, ref: "Customer" },
    partySize: { type: Number, required: true },
    reservationTime: { type: Date, required: true, index: true },
    status: { type: String, default: "pending" },
    notes: { type: String }
  },
  { timestamps: true }
);

module.exports = model("Reservation", ReservationSchema);
