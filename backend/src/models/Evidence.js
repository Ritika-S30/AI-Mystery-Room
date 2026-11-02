import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema(
  {
    mysteryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mystery',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    type: {
      type: String,
      required: true,
      enum: [
        'chat_message',
        'document',
        'written_statement',
        'photograph',
        'cctv_transcript',
        'timeline',
        'investigation_record',
        'other',
      ],
    },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    relevantAt: { type: Date },
    relatedSuspects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Suspect' }],
    relatedLocation: { type: String, trim: true, maxlength: 300 },
    isFictional: { type: Boolean, default: true, immutable: true },
  },
  { timestamps: true },
);

evidenceSchema.index({ mysteryId: 1, createdAt: 1 });

const Evidence = mongoose.models.Evidence || mongoose.model('Evidence', evidenceSchema);

export default Evidence;
