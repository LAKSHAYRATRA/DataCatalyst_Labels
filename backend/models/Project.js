const mongoose = require('mongoose');

const labelSchema = new mongoose.Schema(
  {
    id: String,
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    text: { type: String, default: '' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Untitled Project' },
    audioFile: { type: String },
    audioOriginalName: { type: String },
    transcription: { type: String, default: '' },
    labels: [labelSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
