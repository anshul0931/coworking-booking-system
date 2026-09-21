const { validationResult } = require('express-validator');
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      details: result.array().map(e => ({ field: e.path, message: e.msg }))
    }
  });
};
