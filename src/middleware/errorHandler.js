const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";
  const code = statusCode === 400 ? "ERR_BAD_REQUEST" :
    statusCode === 401 ? "ERR_UNAUTHORIZED" :
    statusCode === 404 ? "ERR_NOT_FOUND" :
    statusCode === 409 ? "ERR_CONFLICT" :
    `ERR_${statusCode}`;

  const payload = {
    success: false,
    statusCode,
    message,
    error: {
      code,
      message,
    },
  };

  if (process.env.NODE_ENV === "development" && statusCode === 500) {
    payload.error.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
};

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, AppError };
