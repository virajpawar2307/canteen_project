const jwt = require('jsonwebtoken');

const requireVoucherAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Unauthorized voucher session' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    if (decoded.authType !== 'voucher') {
      return res.status(403).json({ message: 'Invalid auth type for voucher route' });
    }

    req.voucherSession = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired voucher session' });
  }
};

module.exports = { requireVoucherAuth };
