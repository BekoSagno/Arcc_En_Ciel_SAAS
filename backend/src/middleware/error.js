const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const message =
    err.message || "Une erreur interne est survenue. Veuillez reessayer.";

  return res.status(status).json({ error: message });
};

module.exports = { errorHandler };
