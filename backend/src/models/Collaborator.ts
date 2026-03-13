import { Schema, model, Types } from "mongoose";

const collaboratorSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["viewer", "editor", "admin"],
      default: "viewer",
      required: true,
    },
    invitedBy: { type: Types.ObjectId, ref: "User", default: undefined },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

collaboratorSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const Collaborator = model("Collaborator", collaboratorSchema);
