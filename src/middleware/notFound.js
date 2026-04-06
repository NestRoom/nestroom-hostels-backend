function notFound(_req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
      details: {}
    }
  });
}

module.exports = { notFound };

