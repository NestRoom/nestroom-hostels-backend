function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  const code = err.code || (status === 500 ? 'SERVER_ERROR' : 'ERROR');
  const message = err.expose ? err.message : status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: err.details || {}
    }
  });
}

module.exports = { errorHandler };

