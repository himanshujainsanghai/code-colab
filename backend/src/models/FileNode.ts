import { Schema, model, Types } from "mongoose";

const fileNodeSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    parentId: { type: Types.ObjectId, ref: "FileNode", default: null, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["file", "folder"], required: true },
    content: { type: String, default: "" },
    gridfsId: { type: String, default: null },
    language: { type: String, default: "plaintext" },
  },
  { timestamps: true },
);

fileNodeSchema.index({ projectId: 1, parentId: 1, name: 1 }, { unique: true });

export const FileNode = model("FileNode", fileNodeSchema);
