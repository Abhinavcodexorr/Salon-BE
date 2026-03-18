/**
 * Production-level API response helpers
 * Every response includes: success, statusCode, message, data
 */

const success = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message: message || "Success",
    data: data ?? null,
  });
};

const error = (res, message, statusCode = 500, code = null) => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message: message || "Internal server error",
    error: {
      code: code || `ERR_${statusCode}`,
      message: message || "Internal server error",
    },
  });
};

module.exports = { success, error };
