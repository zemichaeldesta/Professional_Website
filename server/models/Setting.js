const { Schema, model, Types } = require("mongoose");

const SettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = model("Setting", SettingSchema);
