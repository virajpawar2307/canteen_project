const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const GuestPass = require('../models/GuestPass');
const User = require('../models/User');
const Voucher = require('../models/Voucher');

const getRedirectPathByRole = (role) => {
  if (role === 'canteen_manager') return '/canteen';
  return '/coordinator';
};

const parseDateOnly = (dateText) => {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const isVoucherActive = (fromDate, toDate) => {
  const start = parseDateOnly(fromDate);
  const end = parseDateOnly(toDate);
  if (!start || !end) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= start && today <= end;
};

const pickActiveVoucherRecord = (vouchers = []) => {
  const active = vouchers.find((voucher) => isVoucherActive(voucher.fromDate, voucher.toDate));
  return active || vouchers[0] || null;
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Invalid login payload',
      errors: errors.array(),
    });
  }

  const username = req.body.username.trim().toLowerCase();
  const { password } = req.body;

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      department: user.department,
      username: user.username,
    },
    process.env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: '1d' }
  );

  return res.status(200).json({
    message: 'Login successful',
    token,
    redirectPath: getRedirectPathByRole(user.role),
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      department: user.department,
      displayName: user.displayName,
    },
  });
};

const loginWithVoucher = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Invalid voucher payload',
      errors: errors.array(),
    });
  }

  const voucherCode = req.body.voucherCode.trim().toUpperCase();
  const voucherRecords = await Voucher.find({ code: voucherCode }).lean();
  const voucher = pickActiveVoucherRecord(voucherRecords);
  const guestPass = !voucher ? await GuestPass.findOne({ code: voucherCode }).lean() : null;

  if (!voucher && !guestPass) {
    return res.status(404).json({ message: 'Voucher not found. Please enter a valid voucher code.' });
  }

  const authRecord = voucher || guestPass;
  const voucherType = voucher ? voucher.type : 'External';
  const voucherDept = voucher ? voucher.dept : guestPass.dept;
  const voucherName = voucher ? voucher.name : guestPass.name;

  if (!isVoucherActive(authRecord.fromDate, authRecord.toDate)) {
    return res.status(403).json({ message: 'This voucher is not active for today.' });
  }

  const token = jwt.sign(
    {
      authType: 'voucher',
      voucherId: authRecord._id.toString(),
      voucherCode: authRecord.code,
      voucherType,
      voucherName,
      dept: voucherDept || null,
    },
    process.env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: '1d' }
  );

  return res.status(200).json({
    message: 'Voucher validated',
    token,
    redirectPath: voucherType === 'External' ? '/external' : '/examiner',
    voucher: {
      id: authRecord._id,
      code: authRecord.code,
      name: voucherName,
      dept: voucherDept,
      type: voucherType,
      fromDate: authRecord.fromDate,
      toDate: authRecord.toDate,
    },
  });
};

module.exports = { login, loginWithVoucher };
