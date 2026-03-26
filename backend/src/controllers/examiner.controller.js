const { body, validationResult } = require('express-validator');

const GuestPass = require('../models/GuestPass');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');
const CanteenSetting = require('../models/CanteenSetting');

const DEFAULT_CATEGORY_SETTINGS = {
  Breakfast: { status: true, fromTime: '08:30', toTime: '10:30' },
  Lunch: { status: true, fromTime: '12:30', toTime: '14:30' },
  Beverage: { status: true, fromTime: '08:30', toTime: '18:00' },
  Snacks: { status: true, fromTime: '10:30', toTime: '17:30' },
};

const toMinutes = (hhmm = '') => {
  const [hh, mm] = String(hhmm).split(':').map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
};

const isTimeWithinSlot = (fromTime, toTime, now = new Date()) => {
  const start = toMinutes(fromTime);
  const end = toMinutes(toTime);
  if (start === null || end === null) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  if (start <= end) {
    return current >= start && current <= end;
  }

  // Supports overnight slots, if configured in future.
  return current >= start || current <= end;
};

const formatSlot = (fromTime, toTime) => `${fromTime} - ${toTime}`;

const randomDigits = (length) => Math.floor(Math.random() * 10 ** length).toString().padStart(length, '0');

const generateUniqueGuestCode = async () => {
  for (let attempt = 0; attempt < 20000; attempt += 1) {
    const candidate = `G-${randomDigits(4)}`;
    const existing = await GuestPass.exists({ code: candidate });
    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Could not generate unique guest code');
};

const getResolvedCategorySettings = async () => {
  const stored = await CanteenSetting.findOne({ key: 'default' }).lean();
  const merged = {
    ...DEFAULT_CATEGORY_SETTINGS,
    ...(stored?.categorySettings || {}),
  };

  const now = new Date();
  const resolved = {};
  for (const category of Object.keys(merged)) {
    const setting = merged[category] || {};
    const configuredStatus = setting.status !== false;
    const fromTime = setting.fromTime || DEFAULT_CATEGORY_SETTINGS[category]?.fromTime || '00:00';
    const toTime = setting.toTime || DEFAULT_CATEGORY_SETTINGS[category]?.toTime || '23:59';
    const inWindow = isTimeWithinSlot(fromTime, toTime, now);

    resolved[category] = {
      status: configuredStatus && inWindow,
      configuredStatus,
      fromTime,
      toTime,
      slot: formatSlot(fromTime, toTime),
    };
  }

  return resolved;
};

const buildItemsText = (items) => items.map((i) => `${i.qty}x ${i.name}`).join(', ');

const getExaminerSession = async (req, res) => {
  const { voucherCode, voucherType, voucherName, dept } = req.voucherSession;

  const voucherRecord = await Voucher.findOne({ code: voucherCode }).lean();
  const displayName = voucherRecord?.name || voucherName || 'Examiner';

  return res.status(200).json({
    examiner: {
      name: displayName,
      code: voucherCode,
      dept: dept || voucherRecord?.dept || null,
      type: voucherType,
      roleLabel: voucherType === 'External' ? 'External Examiner' : 'Digital Pass',
    },
  });
};

const getExaminerMenu = async (_req, res) => {
  const categorySettings = await getResolvedCategorySettings();
  const menuItems = await MenuItem.find({ isActive: true }).sort({ category: 1, name: 1 }).lean();
  return res.status(200).json({ menuItems, categorySettings });
};

const getExaminerOrders = async (req, res) => {
  const { voucherCode } = req.voucherSession;
  const orders = await Order.find({ voucherCode }).sort({ createdAt: -1 }).lean();

  const mapped = orders.map((order) => ({
    id: order.orderId,
    time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    items: buildItemsText(order.items),
    amount: order.amount,
    status: order.status,
  }));

  return res.status(200).json({ orders: mapped });
};

const placeExaminerOrder = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid order payload', errors: errors.array() });
  }

  const { voucherCode, voucherType, voucherName, dept } = req.voucherSession;
  const requestedItems = req.body.items || [];
  const categorySettings = await getResolvedCategorySettings();

  const menuItemIds = requestedItems.map((i) => i.menuItemId);
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds }, isActive: true }).lean();
  const byId = new Map(menuItems.map((m) => [m._id.toString(), m]));

  const normalizedItems = [];
  for (const item of requestedItems) {
    const menu = byId.get(item.menuItemId);
    if (!menu) continue;

    const categorySetting = categorySettings[menu.category];
    if (!categorySetting || !categorySetting.status) {
      return res.status(400).json({
        message: `${menu.category} is currently unavailable. Allowed timing: ${categorySetting?.slot || 'N/A'}`,
      });
    }

    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    normalizedItems.push({
      menuItemId: menu._id,
      name: menu.name,
      qty,
      price: menu.price,
    });
  }

  if (normalizedItems.length === 0) {
    return res.status(400).json({ message: 'No valid items selected for order' });
  }

  const amount = normalizedItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;

  const created = await Order.create({
    orderId,
    voucherCode,
    voucherType,
    examinerName: voucherName,
    dept: dept || null,
    items: normalizedItems,
    amount,
    status: 'Pending',
  });

  return res.status(201).json({
    order: {
      id: created.orderId,
      time: new Date(created.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: buildItemsText(created.items),
      amount: created.amount,
      status: created.status,
    },
  });
};

const getGuestPasses = async (req, res) => {
  const { voucherCode } = req.voucherSession;
  const guestPasses = await GuestPass.find({ createdByVoucherCode: voucherCode }).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    guestPasses: guestPasses.map((pass) => ({
      id: pass._id,
      name: pass.name,
      email: pass.email,
      phone: pass.phone,
      code: pass.code,
      fromDate: pass.fromDate,
      toDate: pass.toDate,
    })),
  });
};

const createGuestPass = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid guest pass payload', errors: errors.array() });
  }

  const { voucherCode, voucherName, dept } = req.voucherSession;
  const { name, email, phone, fromDate, toDate } = req.body;
  const guestCode = await generateUniqueGuestCode();

  const created = await GuestPass.create({
    code: guestCode,
    name,
    email: email || 'N/A',
    phone,
    fromDate,
    toDate,
    createdByVoucherCode: voucherCode,
    createdByName: voucherName,
    dept: dept || null,
  });

  return res.status(201).json({
    guestPass: {
      id: created._id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      code: created.code,
      fromDate: created.fromDate,
      toDate: created.toDate,
    },
  });
};

const deleteGuestPass = async (req, res) => {
  const { voucherCode } = req.voucherSession;
  const deleted = await GuestPass.findOneAndDelete({
    _id: req.params.id,
    createdByVoucherCode: voucherCode,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Guest pass not found' });
  }

  return res.status(200).json({ message: 'Guest pass deleted' });
};

const orderValidators = [
  body('items').isArray({ min: 1 }).withMessage('items is required'),
  body('items.*.menuItemId').isString().notEmpty().withMessage('menuItemId is required'),
  body('items.*.qty').isInt({ min: 1 }).withMessage('qty must be >= 1'),
];

const guestPassValidators = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('fromDate').isString().notEmpty().withMessage('From date is required'),
  body('toDate').isString().notEmpty().withMessage('To date is required'),
];

module.exports = {
  getExaminerSession,
  getExaminerMenu,
  getExaminerOrders,
  placeExaminerOrder,
  getGuestPasses,
  createGuestPass,
  deleteGuestPass,
  orderValidators,
  guestPassValidators,
};
