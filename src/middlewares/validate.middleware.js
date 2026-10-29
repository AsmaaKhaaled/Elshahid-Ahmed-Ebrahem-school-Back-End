import { AppError } from '../shared/errors/app-error.js';

/**
 * Validation Middleware
 * Accepts either:
 * - A validation function: (req) => { errors }
 * - A schema object with { body, query, params } schema validators
 *
 * @param {Function|Object} validator
 */
export const validate = (validator) => {
  return (req, res, next) => {
    try {
      if (typeof validator === 'function') {
        const error = validator(req);
        if (error) {
          return next(AppError.unprocessableEntity(error.message || 'Validation failed', error.details));
        }
        return next();
      }

      if (typeof validator === 'object' && validator !== null) {
        const errorList = [];

        ['body', 'query', 'params'].forEach((target) => {
          if (validator[target]) {
            const result = validator[target](req[target]);
            if (result && !result.isValid) {
              errorList.push(...(result.errors || [{ field: target, message: result.message }]));
            }
          }
        });

        if (errorList.length > 0) {
          return next(AppError.unprocessableEntity('Validation failed', errorList));
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export default validate;

