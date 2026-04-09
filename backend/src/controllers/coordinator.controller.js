const { validationResult } = require('express-validator');

const GuestPass = require('../models/GuestPass');
const Voucher = require('../models/Voucher');
const Order = require('../models/Order');
const {
  formatDateInAppOffset,
  formatTimeInAppOffset,
  parseDateBoundsInAppOffset,
} = require('../utils/timezone');

const DEPT_LABELS = {
  ce: 'Computer Engineering (CE)',
  it: 'Information Technology (IT)',
  aids: 'Artificial Intelligence and Data Science (AIDS)',
  ece: 'Electronics and Computer Engineering (ECE)',
  entc: 'Electronics and Telecommunication (ENTC)',
};

const getDepartmentCode = (req) => (req.user.department || '').toLowerCase();

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

const mapOrderForReport = (order) => ({
  id: order.orderId,
  name: order.examinerName,
  type: order.voucherType,
  items: order.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
  itemsCount: order.items.reduce((sum, item) => sum + item.qty, 0),
  amount: order.amount,
  date: formatDateInAppOffset(order.createdAt),
  time: formatTimeInAppOffset(order.createdAt),
  subjectName: order.subjectName || 'N/A',
  status: order.status,
});

const randomDigits = (length) => Math.floor(Math.random() * 10 ** length).toString().padStart(length, '0');

const normalizePhone = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  return digits || String(phone || '').trim();
};

const generateUniqueInternalVoucherCode = async (deptCode, reservedCodes = new Set()) => {
  const normalizedDept = String(deptCode || '').toUpperCase();

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const candidate = `PICT-${normalizedDept}-${randomDigits(3)}`;
    if (reservedCodes.has(candidate)) continue;

    const existing = await Voucher.exists({ code: candidate });
    if (!existing) {
      reservedCodes.add(candidate);
      return candidate;
    }
  }

  throw new Error(`Could not generate unique voucher code for ${normalizedDept}`);
};

const loadInternalVoucherMapByPhone = async (deptCode) => {
  const vouchers = await Voucher.find({ dept: deptCode, type: 'Internal' }).lean();
  const map = new Map();
  for (const voucher of vouchers) {
    const phoneKey = normalizePhone(voucher.phone);
    if (phoneKey) {
      map.set(phoneKey, voucher.code);
    }
  }
  return map;
};

const getCoordinatorVouchers = async (req, res) => {
  const deptCode = getDepartmentCode(req);
  const vouchers = await Voucher.find({ dept: deptCode }).sort({ createdAt: -1 });

  return res.status(200).json({
    department: deptCode,
    departmentLabel: DEPT_LABELS[deptCode] || deptCode.toUpperCase(),
    vouchers,
  });
};

const createManualVoucher = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid data', errors: errors.array() });
  }

  const deptCode = getDepartmentCode(req);
  const { name, email, phone, fromDate, toDate, subjectName } = req.body;

  const phoneKey = normalizePhone(phone);
  const existingCodeByPhone = await loadInternalVoucherMapByPhone(deptCode);
  const reservedCodes = new Set(
    (await Voucher.find({ dept: deptCode, type: 'Internal' }).select('code').lean()).map((voucher) => voucher.code)
  );
  const code = existingCodeByPhone.get(phoneKey) || (await generateUniqueInternalVoucherCode(deptCode, reservedCodes));

  const voucher = await Voucher.create({
    name,
    email: email || 'N/A',
    phone,
    code,
    fromDate,
    toDate,
    subjectName: normalizeSubjectName(subjectName) || 'N/A',
    type: 'Internal',
    items: 'Pending',
    amount: 0,
    date: fromDate,
    dept: deptCode,
    createdBy: req.user.sub,
  });

  return res.status(201).json(voucher);
};

const bulkCreateVouchers = async (req, res) => {
  if (!Array.isArray(req.body.entries) || req.body.entries.length === 0) {
    return res.status(400).json({ message: 'entries array is required' });
  }

  const deptCode = getDepartmentCode(req);
  const validEntries = req.body.entries.filter(
    (entry) => entry && entry.name && entry.phone && entry.fromDate && entry.toDate
  );

  const existingCodeByPhone = await loadInternalVoucherMapByPhone(deptCode);
  const reservedCodes = new Set(
    (await Voucher.find({ dept: deptCode, type: 'Internal' }).select('code').lean()).map((voucher) => voucher.code)
  );
  const documents = [];

  for (const entry of validEntries) {
    const phoneKey = normalizePhone(entry.phone);
    const code = existingCodeByPhone.get(phoneKey) || (await generateUniqueInternalVoucherCode(deptCode, reservedCodes));

    const createdDoc = {
      name: entry.name,
      email: entry.email || 'N/A',
      phone: entry.phone,
      code,
      fromDate: entry.fromDate,
      toDate: entry.toDate,
      subjectName: normalizeSubjectName(entry.subjectName) || normalizeSubjectName(entry.items) || 'N/A',
      type: 'Internal',
      items: entry.items || 'Pending',
      amount: Number.isFinite(entry.amount) ? entry.amount : 0,
      date: entry.date || entry.fromDate,
      dept: deptCode,
      createdBy: req.user.sub,
    };
    documents.push(createdDoc);
    existingCodeByPhone.set(phoneKey, code);
  }

  if (documents.length === 0) {
    return res.status(400).json({ message: 'No valid entries found in payload' });
  }

  const created = documents.length > 0 ? await Voucher.insertMany(documents, { ordered: false }) : [];
  const vouchers = await Voucher.find({ dept: deptCode }).sort({ createdAt: -1 }).lean();

  return res.status(201).json({
    count: created.length,
    createdCount: created.length,
    updatedCount: 0,
    vouchers,
  });
};

const deleteVoucher = async (req, res) => {
  const deptCode = getDepartmentCode(req);
  const deleted = await Voucher.findOneAndDelete({ _id: req.params.id, dept: deptCode });
  if (!deleted) {
    return res.status(404).json({ message: 'Voucher not found' });
  }

  return res.status(200).json({ message: 'Voucher deleted' });
};

const clearDepartmentVouchers = async (req, res) => {
  const deptCode = getDepartmentCode(req);
  const result = await Voucher.deleteMany({ dept: deptCode });
  return res.status(200).json({ message: 'Department vouchers cleared', deletedCount: result.deletedCount });
};

const getCoordinatorExternalVouchers = async (req, res) => {
  const deptCode = getDepartmentCode(req);

  const externalVouchers = await GuestPass.find({ dept: deptCode })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    department: deptCode,
    departmentLabel: DEPT_LABELS[deptCode] || deptCode.toUpperCase(),
    externalVouchers,
  });
};

const getCoordinatorReportData = async (req, res) => {
  const deptCode = getDepartmentCode(req);
  const { startDate, endDate, examinerType } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required' });
  }

  const { start, end } = parseDateBounds(startDate, endDate);

  const orders = await Order.find({
    createdAt: { $gte: start, $lte: end },
  })
    .sort({ createdAt: -1 })
    .lean();

  const lookups = await buildOrderLookups(orders);
  const normalizedOrders = orders.map((order) => ({
    ...order,
    dept: resolveOrderDept(order, lookups),
    subjectName: resolveOrderSubjectName(order, lookups),
  }));

  const deptOrders = normalizedOrders.filter((order) => (order.dept || '').toLowerCase() === deptCode);

  const filteredOrders =
    !examinerType || examinerType === 'Both (Internal & External)'
      ? deptOrders
      : deptOrders.filter((order) => order.voucherType === examinerType);

  const mapped = filteredOrders.map(mapOrderForReport);
  const internal = mapped.filter((o) => o.type === 'Internal');
  const external = mapped.filter((o) => o.type === 'External');
  const internalTotal = internal.reduce((sum, o) => sum + o.amount, 0);
  const externalTotal = external.reduce((sum, o) => sum + o.amount, 0);

  return res.status(200).json({
    department: deptCode,
    departmentLabel: DEPT_LABELS[deptCode] || deptCode.toUpperCase(),
    internal,
    external,
    totalOrders: mapped.length,
    internalTotal,
    externalTotal,
    grandTotal: internalTotal + externalTotal,
  });
};

module.exports = {
  getCoordinatorVouchers,
  createManualVoucher,
  bulkCreateVouchers,
  deleteVoucher,
  clearDepartmentVouchers,
  getCoordinatorExternalVouchers,
  getCoordinatorReportData,
};
