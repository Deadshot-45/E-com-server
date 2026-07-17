import mongoose, { Document, Schema } from "mongoose";

export interface IUpload extends Document {
  filename: string;
  contentType: string;
  data: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

const uploadSchema = new Schema<IUpload>(
  {
    filename: { type: String, unique: true, index: true, required: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { versionKey: false, timestamps: true }
);

export default mongoose.model<IUpload>("Upload", uploadSchema);
