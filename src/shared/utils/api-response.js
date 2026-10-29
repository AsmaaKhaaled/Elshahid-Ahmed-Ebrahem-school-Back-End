/**
 * Standardized API Response formatter.
 */
export class ApiResponse {
  /**
   * Send a successful response
   * @param {import('express').Response} res
   * @param {Object} options
   * @param {number} [options.statusCode=200]
   * @param {string} [options.message='Success']
   * @param {*} [options.data=null]
   * @param {Object} [options.meta=null]
   */
  static success(res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) {
    const payload = {
      success: true,
      statusCode,
      message,
      data,
    };

    if (meta) {
      payload.meta = meta;
    }

    return res.status(statusCode).json(payload);
  }

  /**
   * Send a 201 Created response
   * @param {import('express').Response} res
   * @param {*} data
   * @param {string} [message='Resource created successfully']
   */
  static created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, { statusCode: 201, message, data });
  }

  /**
   * Send an error response
   * @param {import('express').Response} res
   * @param {Object} options
   * @param {number} [options.statusCode=500]
   * @param {string} [options.message='Internal Server Error']
   * @param {*} [options.errors=null]
   */
  static error(res, { statusCode = 500, message = 'An error occurred', errors = null } = {}) {
    const payload = {
      success: false,
      statusCode,
      message,
    };

    if (errors) {
      payload.errors = errors;
    }

    return res.status(statusCode).json(payload);
  }
}

export default ApiResponse;

