const mongoose = require('mongoose');
// Mutex collection: unique key guarantees only one writer per space at a time.
// Works on standalone MongoDB (no replica set / transactions required).
const lockSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
});
lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('Lock', lockSchema);
