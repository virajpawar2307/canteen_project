const express = require('express');
const { body } = require('express-validator');

const { login, loginWithVoucher } = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/login',
  [
    body('username').trim().isEmail().withMessage('Valid username email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  login
);

router.post(
  '/voucher-login',
  [
    body('voucherCode').trim().notEmpty().withMessage('Voucher code is required'),
  ],
  loginWithVoucher
);

module.exports = router;
