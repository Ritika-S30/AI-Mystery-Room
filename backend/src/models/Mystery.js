import mongoose from 'mongoose';

const clueConnectionSchema = new mongoose.Schema(
  {
    evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
    explanation: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const solutionSchema = new mongoose.Schema(
  {
    culpritSuspectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Suspect' },
    motive: { type: String, trim: true, maxlength: 3000 },
    whatHappened: { type: String, trim: true, maxlength: 5000 },
    explanation: { type: String, trim: true, maxlength: 8000 },
    importantClues: { type: [clueConnectionSchema], default: [] },
    redHerrings: { type: [clueConnectionSchema], default: [] },
  },
  { _id: false },
);

const timelineEventSchema = new mongoose.Schema(
  {
    at: { type: String, required: true, trim: true, maxlength: 120 },
    event: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const mysterySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    scenario: { type: String, required: true, trim: true, maxlength: 10000 },
    location: { type: String, trim: true, maxlength: 300 },
    timeline: { type: [timelineEventSchema], default: [] },
    victim: {
      name: { type: String, trim: true, maxlength: 120 },
      description: { type: String, trim: true, maxlength: 2000 },
    },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    // Never include these in ordinary mystery responses. Select explicitly only in
    // accusation/reveal logic, and construct the permitted response deliberately.
    solution: { type: solutionSchema, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, returned) {
        delete returned.solution;
        return returned;
      },
    },
  },
);

mysterySchema.index({ status: 1, createdAt: -1 });

const Mystery = mongoose.models.Mystery || mongoose.model('Mystery', mysterySchema);

export default Mystery;
