const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getTokenFromHeader(header = '') {
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function requireAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req.headers.authorization || '');
    if (!token) {
      return res.status(401).json({ message: 'Missing authorization token.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devcollab-secret');
    const user = await User.findById(payload.id).select('username createdAt');

    if (!user) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }
}

module.exports = requireAuth;
