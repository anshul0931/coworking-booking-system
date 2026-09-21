const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw ApiError.unauthorized('Missing access token');
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('User no longer exists');
    req.user = user;
    next();
  } catch (e) { next(e); }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient permissions'));
  next();
};
module.exports = { protect, authorize };
