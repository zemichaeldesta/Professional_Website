const { Schema, model, Types } = require("mongoose");

const USER_ROLES = ["manager", "staff", "customer"];

const UserSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "staff" },
    name: { type: String, trim: true },
    customer: { type: Types.ObjectId, ref: "Customer" }
  },
  { timestamps: true }
);

const User = model("User", UserSchema);

User.ROLES = USER_ROLES;

module.exports = User;
