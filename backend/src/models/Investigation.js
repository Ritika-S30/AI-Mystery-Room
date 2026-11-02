import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const investigationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    guestId: {
      type: String,
      default() {
        return this.userId ? undefined : randomUUID();
      },
      index: true,
    },
    mysteryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mystery',
      required: true,
      index: true,
    },
    notes: { type: [noteSchema], default: [] },
    reviewedEvidence: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
    hintsUsed: { type: Number, min: 0, default: 0 },
    accusation: { type: mongoose.Schema.Types.ObjectId, ref: 'Suspect' },
    result: { type: Boolean, default: null },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

investigationSchema.index({ userId: 1, updatedAt: -1 });
investigationSchema.index({ guestId: 1, updatedAt: -1 });

const Investigation = mongoose.models.Investigation || mongoose.model('Investigation', investigationSchema);

export default Investigation;
