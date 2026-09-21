const router = require('express').Router();
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Booking = require('../models/Booking');
const Space = require('../models/Space');
const { withLock } = require('../utils/lock');
const { toDate, overlapQuery } = require('../utils/time');
const notify = require('../utils/notify');

/* ---------- MEMBER: create booking (concurrency-safe) ---------- */
router.post('/', protect,
  [
    body('spaceId').isMongoId().withMessage('Valid spaceId required'),
    body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date=YYYY-MM-DD'),
    body('start').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('start=HH:mm'),
    body('end').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('end=HH:mm'),
    body('notes').optional().isLength({ max: 300 })
  ], validate,
  asyncHandler(async (req, res) => {
    const { spaceId, date, start, end, notes } = req.body;
    const startAt = toDate(date, start), endAt = toDate(date, end);
    if (!startAt || !endAt) throw ApiError.badRequest('Invalid date/time');
    if (endAt <= startAt) throw ApiError.badRequest('End time must be after start time');
    if (startAt.getTime() < Date.now()) throw ApiError.badRequest('Cannot book a past slot');
    if (endAt - startAt > 12 * 36e5) throw ApiError.badRequest('Booking cannot exceed 12 hours');

    const space = await Space.findById(spaceId);
    if (!space || !space.isActive) throw ApiError.notFound('Space not found or inactive');

    // Serialize all booking writes for this space -> no double booking
    const booking = await withLock(`space:${spaceId}`, async () => {
      const clash = await Booking.findOne(overlapQuery(space._id, startAt, endAt));
      if (clash) {
        throw ApiError.conflict('This slot overlaps an existing booking or maintenance window', {
          conflictWith: { start: clash.startAt, end: clash.endAt, status: clash.status, kind: clash.kind }
        });
      }
      return Booking.create({ space: space._id, user: req.user._id, date, startAt, endAt, notes: notes || '' });
    });

    notify(req.user.email, 'Booking created', `Your booking for ${space.name} on ${date} ${start}-${end} is pending approval.`);
    res.status(201).json({ success: true, data: booking });
  }));

/* ---------- MEMBER: own bookings ---------- */
router.get('/my', protect, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [data, total] = await Promise.all([
    Booking.find(filter).populate('space', 'name type capacity').sort({ startAt: -1 }).skip((page - 1) * limit).limit(limit),
    Booking.countDocuments(filter)
  ]);
  res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

/* ---------- MEMBER: cancel own future booking ---------- */
router.patch('/:id/cancel', protect, [param('id').isMongoId()], validate, asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  const isOwner = booking.user && booking.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') throw ApiError.forbidden('Not your booking');
  if (!['pending', 'approved'].includes(booking.status)) throw ApiError.badRequest(`Cannot cancel a ${booking.status} booking`);
  if (booking.startAt.getTime() <= Date.now()) throw ApiError.badRequest('Only future bookings can be cancelled');
  booking.status = 'cancelled';
  await booking.save();
  notify(req.user.email, 'Booking cancelled', `Booking ${booking._id} cancelled.`);
  res.json({ success: true, data: booking });
}));

/* ---------- ADMIN: list all bookings ---------- */
router.get('/', protect, authorize('admin'),
  [query('status').optional().isIn(['pending', 'approved', 'rejected', 'cancelled'])], validate,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.spaceId) filter.space = req.query.spaceId;
    if (req.query.date) filter.date = req.query.date;
    if (req.query.from || req.query.to) {
      filter.startAt = {};
      if (req.query.from) filter.startAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.startAt.$lte = new Date(req.query.to);
    }
    const [data, total] = await Promise.all([
      Booking.find(filter).populate('space', 'name type').populate('user', 'name email')
        .sort({ startAt: -1 }).skip((page - 1) * limit).limit(limit),
      Booking.countDocuments(filter)
    ]);
    res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }));

/* ---------- ADMIN: approve (auto-reject overlaps) ---------- */
router.patch('/:id/approve', protect, authorize('admin'), [param('id').isMongoId()], validate,
  asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate('user', 'email');
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.status !== 'pending') throw ApiError.badRequest(`Booking is already ${booking.status}`);

    const result = await withLock(`space:${booking.space}`, async () => {
      const approvedClash = await Booking.findOne({
        ...overlapQuery(booking.space, booking.startAt, booking.endAt, ['approved']),
        _id: { $ne: booking._id }
      });
      if (approvedClash) throw ApiError.conflict('An approved booking already occupies this slot');

      booking.status = 'approved';
      booking.decidedBy = req.user._id; booking.decidedAt = new Date();
      await booking.save();

      // auto-reject every other pending overlapping booking
      const others = await Booking.find({
        ...overlapQuery(booking.space, booking.startAt, booking.endAt, ['pending']),
        _id: { $ne: booking._id }
      }).populate('user', 'email');
      await Booking.updateMany({ _id: { $in: others.map(o => o._id) } },
        { status: 'rejected', notes: 'Auto-rejected: slot approved for another member', decidedBy: req.user._id, decidedAt: new Date() });
      others.forEach(o => notify(o.user?.email, 'Booking rejected', 'Slot was approved for another member.'));
      return { booking, autoRejected: others.length };
    });

    notify(booking.user?.email, 'Booking approved', `Your booking ${booking._id} is approved.`);
    res.json({ success: true, data: result });
  }));

/* ---------- ADMIN: reject ---------- */
router.patch('/:id/reject', protect, authorize('admin'),
  [param('id').isMongoId(), body('reason').optional().isString()], validate,
  asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate('user', 'email');
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.status !== 'pending') throw ApiError.badRequest(`Booking is already ${booking.status}`);
    booking.status = 'rejected';
    booking.notes = req.body.reason || 'Rejected by admin';
    booking.decidedBy = req.user._id; booking.decidedAt = new Date();
    await booking.save();
    notify(booking.user?.email, 'Booking rejected', booking.notes);
    res.json({ success: true, data: booking });
  }));

module.exports = router;
