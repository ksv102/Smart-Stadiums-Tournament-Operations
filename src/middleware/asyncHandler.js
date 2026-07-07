'use strict';

/**
 * Wraps an async route handler so a rejected promise is forwarded to
 * Express's error-handling middleware instead of crashing the process or
 * hanging the request. Express does not do this automatically for async
 * functions.
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>} fn
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void}
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
