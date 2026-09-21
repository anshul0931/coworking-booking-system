class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status; this.code = code; this.details = details;
  }
  static badRequest(m, d) { return new ApiError(400, 'BAD_REQUEST', m, d); }
  static unauthorized(m = 'Unauthorized') { return new ApiError(401, 'UNAUTHORIZED', m); }
  static forbidden(m = 'Forbidden') { return new ApiError(403, 'FORBIDDEN', m); }
  static notFound(m = 'Not found') { return new ApiError(404, 'NOT_FOUND', m); }
  static conflict(m, d) { return new ApiError(409, 'CONFLICT', m, d); }
}
module.exports = ApiError;
