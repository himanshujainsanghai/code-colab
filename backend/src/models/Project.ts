import { Schema, model, Types } from "mongoose";

const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    description: { type: String, default: "" },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Project = model("Project", projectSchema);
