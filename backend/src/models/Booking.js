const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  space: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  kind: { type: String, enum: ['booking', 'maintenance'], default: 'booking', index: true },
  date: { type: String, required: true, index: true },          // YYYY-MM-DD
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  notes: { type: String, default: '' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true });

// compound indexes for range/conflict queries and admin filters
bookingSchema.index({ space: 1, startAt: 1, endAt: 1, status: 1 });
bookingSchema.index({ status: 1, date: 1 });
bookingSchema.index({ user: 1, startAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
