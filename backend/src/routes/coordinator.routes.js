const express = require('express');
const { body } = require('express-validator');

const {
  getCoordinatorVouchers,
  createManualVoucher,
  bulkCreateVouchers,
  deleteVoucher,
  clearDepartmentVouchers,
  getCoordinatorExternalVouchers,
  deleteCoordinatorExternalVoucher,
  clearCoordinatorExternalVouchers,
  getCoordinatorReportData,
} = require('../controllers/coordinator.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth, requireRole('coordinator'));

router.get('/vouchers', getCoordinatorVouchers);

router.post(
  '/vouchers',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('fromDate').isString().notEmpty().withMessage('From date is required'),
    body('toDate').isString().notEmpty().withMessage('To date is required'),
  ],
  createManualVoucher
);

router.post('/vouchers/bulk', bulkCreateVouchers);
router.delete('/vouchers/:id', deleteVoucher);
router.delete('/vouchers', clearDepartmentVouchers);
router.get('/external-vouchers', getCoordinatorExternalVouchers);
router.delete('/external-vouchers/:id', deleteCoordinatorExternalVoucher);
router.delete('/external-vouchers', clearCoordinatorExternalVouchers);
router.get('/reports', getCoordinatorReportData);

module.exports = router;
