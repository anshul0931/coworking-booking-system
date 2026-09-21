// 404 handler
const notFound = (req, res, next) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.originalUrl} not found` } });
};

// Centralized error handler -> consistent JSON error shape
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details || null;

  if (err.name === 'ValidationError') {
    status = 400; code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
    message = 'Validation failed';
  }
  if (err.name === 'CastError') { status = 400; code = 'INVALID_ID'; message = 'Invalid identifier'; }
  if (err.code === 11000) { status = 409; code = 'DUPLICATE'; message = 'Duplicate value'; details = err.keyValue; }
  if (err.name === 'JsonWebTokenError') { status = 401; code = 'INVALID_TOKEN'; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError') { status = 401; code = 'TOKEN_EXPIRED'; message = 'Token expired'; }

  if (status === 500) console.error(err);
  res.status(status).json({ success: false, error: { code, message, details } });
};
module.exports = { notFound, errorHandler };
