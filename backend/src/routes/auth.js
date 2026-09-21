const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const signAccess = (user) => jwt.sign(
  { sub: user._id.toString(), role: user.role },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' }
);

const issueRefresh = async (user) => {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
  const token = jwt.sign(
    { sub: user._id.toString(), jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${days}d` }
  );
  await RefreshToken.create({ user: user._id, token, expiresAt: new Date(Date.now() + days * 864e5) });
  return token;
};

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post('/register', authLimiter,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name min 2 chars'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('role').optional().isIn(['member', 'admin'])
  ], validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (await User.findOne({ email })) throw ApiError.conflict('Email already registered');
    const user = await User.create({ name, email, password, role: role === 'admin' ? 'admin' : 'member' });
    const refreshToken = await issueRefresh(user);
    res.status(201).json({ success: true, data: { user: publicUser(user), accessToken: signAccess(user), refreshToken } });
  }));

router.post('/login', authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()], validate,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    if (!user || !(await user.comparePassword(req.body.password))) throw ApiError.unauthorized('Invalid credentials');
    const refreshToken = await issueRefresh(user);
    res.json({ success: true, data: { user: publicUser(user), accessToken: signAccess(user), refreshToken } });
  }));

// Refresh flow with rotation
router.post('/refresh', [body('refreshToken').notEmpty()], validate, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const stored = await RefreshToken.findOne({ token: refreshToken, revoked: false });
  if (!stored) throw ApiError.unauthorized('Refresh token revoked or unknown');
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User not found');
  stored.revoked = true; await stored.save();
  const newRefresh = await issueRefresh(user);
  res.json({ success: true, data: { accessToken: signAccess(user), refreshToken: newRefresh } });
}));

router.post('/logout', [body('refreshToken').notEmpty()], validate, asyncHandler(async (req, res) => {
  await RefreshToken.updateOne({ token: req.body.refreshToken }, { revoked: true });
  res.json({ success: true, data: { message: 'Logged out' } });
}));

router.get('/me', protect, asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
}));

module.exports = router;
