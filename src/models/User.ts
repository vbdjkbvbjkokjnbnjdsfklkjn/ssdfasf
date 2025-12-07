import mongoose, { Schema, type Model, type Document } from "mongoose";

export type UserDocument = Document & {
  username: string;
};

const UserSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);
