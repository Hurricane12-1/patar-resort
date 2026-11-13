export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.statusCode = status;
    if (typeof extra === 'string') {
      this.code = extra;
    } else if (extra && typeof extra === 'object') {
      this.code = extra.code;
      this.details = extra.details;
    }
  }
}
export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const notFound = (_req, res) => res.status(404).json({ message: 'Not found' });
export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const resp = {
    message: status >= 500 ? 'Server error' : err.message,
    ...(err.code ? { code: err.code } : {}),
    ...(err.details ? { details: err.details } : {}),
  };
  res.status(status).json(resp);
}
