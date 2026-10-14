export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; this.statusCode = status; }
}
export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const notFound = (_req, res) => res.status(404).json({ message: 'Not found' });
export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Server error' : err.message });
}
