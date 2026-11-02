import mongoose from 'mongoose';

const suspectSchema = new mongoose.Schema(
  {
    mysteryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mystery',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    age: { type: Number, min: 0, max: 130 },
    background: { type: String, trim: true, maxlength: 4000 },
    relationshipToCase: { type: String, trim: true, maxlength: 500 },
    motive: { type: String, trim: true, maxlength: 2000 },
    alibi: { type: String, trim: true, maxlength: 2000 },
    relevantInformation: { type: String, trim: true, maxlength: 3000 },
  },
  { timestamps: true },
);

suspectSchema.index({ mysteryId: 1, createdAt: 1 });

const Suspect = mongoose.models.Suspect || mongoose.model('Suspect', suspectSchema);

export default Suspect;
