function getHelmetConfig() {
  return {
    // API-only service: CSP is typically enforced by the frontend hosting layer
    contentSecurityPolicy: false
  };
}

module.exports = { getHelmetConfig };

