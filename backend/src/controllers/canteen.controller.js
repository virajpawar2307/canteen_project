const { validationResult } = require('express-validator');

const CanteenSetting = require('../models/CanteenSetting');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');
const GuestPass = require('../models/GuestPass');
const {
  formatDateInAppOffset,
  formatTimeInAppOffset,
  parseDateBoundsInAppOffset,
} = require('../utils/timezone');

const PRICE_LIMITS = {
  Breakfast: 50,
  Lunch: 100,
  Beverage: 30,
  Snacks: 30,
};

const DEPT_LABELS = {
  ce: 'Computer Engineering (CE)',
  it: 'Information Technology (IT)',
  aids: 'Artificial Intelligence and Data Science (AIDS)',
  ece: 'Electronics and Computer Engineering (ECE)',
  entc: 'Electronics and Telecommunication (ENTC)',
};

const parseDateBounds = (startDate, endDate) => {
  return parseDateBoundsInAppOffset(startDate, endDate);
};

const normalizeSubjectName = (subjectName = '') => String(subjectName || '').trim();

const getSubjectFromVoucherRecord = (voucher) => {
  const direct = normalizeSubjectName(voucher?.subjectName);
  if (direct) return direct;

  // Backward compatibility for old records where subject was stored in items.
  const legacy = normalizeSubjectName(voucher?.items);
  return legacy || 'N/A';
};

const buildOrderLookups = async (orders) => {
  const voucherCodes = [...new Set(orders.map((order) => order.voucherCode).filter(Boolean))];

  const [vouchers, guestPasses] = await Promise.all([
    Voucher.find({ code: { $in: voucherCodes } }).select('code dept subjectName items').lean(),
    GuestPass.find({ code: { $in: voucherCodes } }).select('code dept subjectName createdByVoucherCode').lean(),
  ]);

  const voucherByCode = new Map(vouchers.map((voucher) => [voucher.code, voucher]));
  const guestByCode = new Map(guestPasses.map((pass) => [pass.code, pass]));

  const creatorVoucherCodes = [
    ...new Set(guestPasses.map((pass) => pass.createdByVoucherCode).filter((code) => code && !voucherByCode.has(code))),
  ];

  let creatorVoucherByCode = new Map();
  if (creatorVoucherCodes.length > 0) {
    const creatorVouchers = await Voucher.find({ code: { $in: creatorVoucherCodes } })
      .select('code subjectName items')
      .lean();
    creatorVoucherByCode = new Map(creatorVouchers.map((voucher) => [voucher.code, voucher]));
  }

  return { voucherByCode, guestByCode, creatorVoucherByCode };
};

const resolveOrderSubjectName = (order, lookups) => {
  const { voucherByCode, guestByCode, creatorVoucherByCode } = lookups;

  if (order.voucherType === 'Internal') {
    return getSubjectFromVoucherRecord(voucherByCode.get(order.voucherCode));
  }

  const guestPass = guestByCode.get(order.voucherCode);
  const guestSubject = normalizeSubjectName(guestPass?.subjectName);
  if (guestSubject) return guestSubject;

  const creatorVoucher = voucherByCode.get(guestPass?.createdByVoucherCode) || creatorVoucherByCode.get(guestPass?.createdByVoucherCode);
  return getSubjectFromVoucherRecord(creatorVoucher);
};

const resolveOrderDept = (order, lookups) => {
  if (order.dept) return order.dept;

  const voucherDept = lookups.voucherByCode.get(order.voucherCode)?.dept;
  if (voucherDept) return voucherDept;

  return lookups.guestByCode.get(order.voucherCode)?.dept || null;
};

const mapOrder = (order) => ({
  id: order.orderId,
  name: order.examinerName,
  type: order.voucherType,
  items: order.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
  itemsCount: order.items.reduce((sum, item) => sum + item.qty, 0),
  amount: order.amount,
  time: formatTimeInAppOffset(order.createdAt),
  date: formatDateInAppOffset(order.createdAt),
  subjectName: order.subjectName || 'N/A',
  createdAt: order.createdAt,
  dept: DEPT_LABELS[order.dept] || order.dept || 'N/A',
  deptCode: order.dept || null,
  status: order.status,
});

const getOrders = async (req, res) => {
  const status = (req.query.status || 'Pending').trim();
  const query = status.toLowerCase() === 'all' ? {} : { status: status === 'Processed' ? 'Processed' : 'Pending' };

  const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
  return res.status(200).json({ orders: orders.map(mapOrder) });
};

const processOrder = async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { orderId: req.params.orderId },
    { status: 'Processed' },
    { new: true }
  ).lean();

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  return res.status(200).json({ order: mapOrder(order) });
};

const getMenuAndSettings = async (_req, res) => {
  const [settings, menuItems] = await Promise.all([
    CanteenSetting.findOne({ key: 'default' }).lean(),
    MenuItem.find({ isActive: true }).sort({ category: 1, name: 1 }).lean(),
  ]);

  return res.status(200).json({
    categorySettings: settings?.categorySettings || {},
    menuItems,
    priceLimits: PRICE_LIMITS,
  });
};

const updateCategorySettings = async (req, res) => {
  if (!req.body.categorySettings || typeof req.body.categorySettings !== 'object') {
    return res.status(400).json({ message: 'categorySettings object is required' });
  }

  const updated = await CanteenSetting.findOneAndUpdate(
    { key: 'default' },
    { categorySettings: req.body.categorySettings },
    { new: true, upsert: true }
  ).lean();

  return res.status(200).json({ categorySettings: updated.categorySettings });
};

const createMenuItem = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid menu item payload', errors: errors.array() });
  }

  const { name, category, price } = req.body;
  const numericPrice = Number(price);
  const limit = PRICE_LIMITS[category];

  if (numericPrice > limit) {
    return res.status(400).json({ message: `Price limit exceeded. Max for ${category} is Rs${limit}.` });
  }

  const created = await MenuItem.create({ name: name.trim(), category, price: numericPrice, isActive: true });
  return res.status(201).json({ menuItem: created });
};

const updateMenuItem = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid menu item payload', errors: errors.array() });
  }

  const { name, category, price } = req.body;
  const numericPrice = Number(price);
  const limit = PRICE_LIMITS[category];

  if (numericPrice > limit) {
    return res.status(400).json({ message: `Price limit exceeded. Max for ${category} is Rs${limit}.` });
  }

  const updated = await MenuItem.findOneAndUpdate(
    { _id: req.params.itemId, isActive: true },
    { name: name.trim(), category, price: numericPrice },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) {
    return res.status(404).json({ message: 'Menu item not found' });
  }

  return res.status(200).json({ menuItem: updated });
};

const deleteMenuItem = async (req, res) => {
  const deleted = await MenuItem.findOneAndUpdate(
    { _id: req.params.itemId, isActive: true },
    { isActive: false },
    { new: true }
  ).lean();

  if (!deleted) {
    return res.status(404).json({ message: 'Menu item not found' });
  }

  return res.status(200).json({ message: 'Menu item deleted successfully' });
};

const getReportData = async (req, res) => {
  const { startDate, endDate, department, examinerType } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required' });
  }

  const { start, end } = parseDateBounds(startDate, endDate);

  const orders = await Order.find({ createdAt: { $gte: start, $lte: end } }).lean();

  const lookups = await buildOrderLookups(orders);

  const enrichedOrders = orders.map((order) => ({
    ...order,
    dept: resolveOrderDept(order, lookups),
    subjectName: resolveOrderSubjectName(order, lookups),
  }));

  const filtered = enrichedOrders.filter((order) => {
    const deptLabel = DEPT_LABELS[order.dept] || order.dept || 'N/A';
    const deptOk = !department || department === 'All Departments' || deptLabel === department;
    const typeOk = !examinerType || examinerType === 'Both (Internal & External)' || order.voucherType === examinerType;
    return deptOk && typeOk;
  });

  const mapped = filtered.map(mapOrder);
  const internal = mapped.filter((o) => o.type === 'Internal');
  const external = mapped.filter((o) => o.type === 'External');
  const internalTotal = internal.reduce((sum, o) => sum + o.amount, 0);
  const externalTotal = external.reduce((sum, o) => sum + o.amount, 0);

  return res.status(200).json({
    orders: mapped,
    internal,
    external,
    totalOrders: mapped.length,
    internalTotal,
    externalTotal,
    grandTotal: internalTotal + externalTotal,
  });
};

module.exports = {
  getOrders,
  processOrder,
  getMenuAndSettings,
  updateCategorySettings,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getReportData,
};
