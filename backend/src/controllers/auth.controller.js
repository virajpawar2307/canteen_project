const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const GuestPass = require('../models/GuestPass');
const User = require('../models/User');
const Voucher = require('../models/Voucher');
const { formatDateInAppOffset } = require('../utils/timezone');

const getRedirectPathByRole = (role) => {
  if (role === 'canteen_manager') return '/canteen';
  return '/coordinator';
};

const parseDateOnlyKey = (dateText) => {
  const match = String(dateText || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return year * 10000 + month * 100 + day;
};

const isVoucherActive = (fromDate, toDate) => {
  const start = parseDateOnlyKey(fromDate);
  const end = parseDateOnlyKey(toDate);
  if (!start || !end) return false;

  const todayKey = parseDateOnlyKey(formatDateInAppOffset(new Date()));
  if (!todayKey) return false;

  return todayKey >= start && todayKey <= end;
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
