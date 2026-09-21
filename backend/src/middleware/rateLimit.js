const rateLimit = require('express-rate-limit');
const handler = (req, res) => res.status(429).json({
  success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' }
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, handler });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, handler });
module.exports = { authLimiter, apiLimiter };
