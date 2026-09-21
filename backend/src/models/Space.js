const mongoose = require('mongoose');

const spaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['desk', 'room'], required: true, index: true },
  capacity: { type: Number, required: true, min: 1, index: true },
  amenities: [{ type: String, trim: true }],
  description: { type: String, default: '' },
  pricePerHour: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

spaceSchema.index({ name: 'text', description: 'text' });
spaceSchema.index({ type: 1, capacity: 1, isActive: 1 });
module.exports = mongoose.model('Space', spaceSchema);
