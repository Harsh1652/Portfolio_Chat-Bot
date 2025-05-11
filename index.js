// Simple redirect to frontend build
module.exports = (req, res) => {
  res.setHeader('Location', '/');
  res.status(302).send();
};