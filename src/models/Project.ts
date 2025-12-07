import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ProjectDocument = Document & {
  name: string;
  description?: string;
  baseModel: string;
  ownerUsername: string;
};

const ProjectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    baseModel: { type: String, required: true },
    ownerUsername: { type: String, required: true },
  },
  { timestamps: true }
);

ProjectSchema.index({ ownerUsername: 1 });

export const Project: Model<ProjectDocument> =
  mongoose.models.Project || mongoose.model<ProjectDocument>("Project", ProjectSchema);
