const router = require('express').Router();
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Space = require('../models/Space');
const Booking = require('../models/Booking');
const { toDate, overlapQuery } = require('../utils/time');

/* ---------------- PUBLIC ---------------- */

// GET /api/spaces?search=&type=&minCapacity=&date=&start=&end=&page=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 9));
  const filter = { isActive: true };

  if (req.query.search) filter.name = { $regex: req.query.search.trim(), $options: 'i' };
  if (req.query.type && ['desk', 'room'].includes(req.query.type)) filter.type = req.query.type;
  if (req.query.minCapacity) filter.capacity = { $gte: Number(req.query.minCapacity) };

  let spaces = await Space.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const total = await Space.countDocuments(filter);

  // Optional availability filter for a date (+ optional time window)
  if (req.query.date) {
    const start = toDate(req.query.date, req.query.start || '00:00');
    const end = toDate(req.query.date, req.query.end || '23:59');
    if (start && end) {
      const ids = spaces.map(s => s._id);
      const busy = await Booking.find({
        space: { $in: ids }, status: { $in: ['pending', 'approved'] },
        startAt: { $lt: end }, endAt: { $gt: start }
      }).distinct('space');
      const busySet = new Set(busy.map(String));
      spaces = spaces.map(s => ({ ...s, availableOnDate: !busySet.has(String(s._id)) }));
      if (req.query.onlyAvailable === 'true') spaces = spaces.filter(s => s.availableOnDate);
    }
  }

  res.json({
    success: true,
    data: spaces,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}));

router.get('/:id', [param('id').isMongoId()], validate, asyncHandler(async (req, res) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw ApiError.notFound('Space not found');
  res.json({ success: true, data: space });
}));

// Availability calendar for a given date -> busy slots + free slots (hourly grid)
router.get('/:id/availability',
  [param('id').isMongoId(), query('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date=YYYY-MM-DD required')],
  validate,
  asyncHandler(async (req, res) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw ApiError.notFound('Space not found');
    const { date } = req.query;
    const dayStart = toDate(date, '00:00');
    const dayEnd = new Date(dayStart.getTime() + 864e5);

    const bookings = await Booking.find({
      space: space._id, status: { $in: ['pending', 'approved'] },
      startAt: { $lt: dayEnd }, endAt: { $gt: dayStart }
    }).select('startAt endAt status kind').sort({ startAt: 1 }).lean();

    const slots = [];
    for (let h = 8; h < 21; h++) {
      const s = new Date(dayStart.getTime() + h * 36e5);
      const e = new Date(s.getTime() + 36e5);
      const clash = bookings.find(b => b.startAt < e && b.endAt > s);
      slots.push({
        start: `${String(h).padStart(2, '0')}:00`,
        end: `${String(h + 1).padStart(2, '0')}:00`,
        status: clash ? (clash.kind === 'maintenance' ? 'maintenance' : clash.status) : 'free'
      });
    }
    res.json({ success: true, data: { space: { id: space._id, name: space.name }, date, slots, bookings } });
  }));

/* ---------------- ADMIN ---------------- */
const spaceRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name required'),
  body('type').isIn(['desk', 'room']).withMessage('type must be desk|room'),
  body('capacity').isInt({ min: 1 }).withMessage('capacity >= 1'),
  body('amenities').optional().isArray(),
  body('pricePerHour').optional().isFloat({ min: 0 })
];

router.post('/', protect, authorize('admin'), spaceRules, validate, asyncHandler(async (req, res) => {
  const space = await Space.create(req.body);
  res.status(201).json({ success: true, data: space });
}));

router.put('/:id', protect, authorize('admin'), [param('id').isMongoId(), ...spaceRules], validate,
  asyncHandler(async (req, res) => {
    const space = await Space.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!space) throw ApiError.notFound('Space not found');
    res.json({ success: true, data: space });
  }));

router.delete('/:id', protect, authorize('admin'), [param('id').isMongoId()], validate,
  asyncHandler(async (req, res) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw ApiError.notFound('Space not found');
    await Booking.updateMany(
      { space: space._id, status: { $in: ['pending', 'approved'] }, endAt: { $gt: new Date() } },
      { status: 'cancelled' }
    );
    await space.deleteOne();
    res.json({ success: true, data: { message: 'Space deleted, future bookings cancelled' } });
  }));

// Maintenance block-out
router.post('/:id/maintenance', protect, authorize('admin'),
  [
    param('id').isMongoId(),
    body('date').matches(/^\d{4}-\d{2}-\d{2}$/),
    body('start').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
    body('end').matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
    body('notes').optional().isString()
  ], validate,
  asyncHandler(async (req, res) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw ApiError.notFound('Space not found');
    const { date, start, end, notes } = req.body;
    const startAt = toDate(date, start), endAt = toDate(date, end);
    if (endAt <= startAt) throw ApiError.badRequest('end must be after start');

    // any pending/approved booking inside the window gets auto-rejected
    const clashing = await Booking.find({ ...overlapQuery(space._id, startAt, endAt), kind: 'booking' });
    await Booking.updateMany({ _id: { $in: clashing.map(c => c._id) } },
      { status: 'rejected', notes: 'Auto-rejected: maintenance window', decidedBy: req.user._id, decidedAt: new Date() });

    const block = await Booking.create({
      space: space._id, kind: 'maintenance', date, startAt, endAt,
      status: 'approved', notes: notes || 'Maintenance', decidedBy: req.user._id, decidedAt: new Date()
    });
    res.status(201).json({ success: true, data: { maintenance: block, autoRejected: clashing.length } });
  }));

module.exports = router;
