import { Schema, model, Types } from "mongoose";

const invitationSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    invitedBy: { type: Types.ObjectId, ref: "User", required: true, index: true },
    invitedEmail: { type: String, required: true, index: true },
    invitedUserId: { type: Types.ObjectId, ref: "User", default: undefined },
    role: {
      type: String,
      enum: ["viewer", "editor", "admin"],
      default: "viewer",
      required: true,
    },
    token: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
      required: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

invitationSchema.index({ projectId: 1, invitedEmail: 1, status: 1 });

export const Invitation = model("Invitation", invitationSchema);
