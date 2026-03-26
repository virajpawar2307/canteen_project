const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'canteen-backend',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
