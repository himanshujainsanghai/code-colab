import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String, default: "" },
    techStack: [{ type: String }],
    resetPasswordTokenHash: { type: String, default: undefined },
    resetPasswordExpiresAt: { type: Date, default: undefined },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
