const express = require('express');

const {
  createGuestPass,
  deleteGuestPass,
  getExaminerMenu,
  getExaminerOrders,
  getExaminerSession,
  getGuestPasses,
  guestPassValidators,
  orderValidators,
  placeExaminerOrder,
} = require('../controllers/examiner.controller');
const { requireVoucherAuth } = require('../middlewares/voucherAuth');

const router = express.Router();

router.use(requireVoucherAuth);

router.get('/session', getExaminerSession);
router.get('/menu', getExaminerMenu);
router.get('/orders', getExaminerOrders);
router.post('/orders', orderValidators, placeExaminerOrder);
router.get('/guest-passes', getGuestPasses);
router.post('/guest-passes', guestPassValidators, createGuestPass);
router.delete('/guest-passes/:id', deleteGuestPass);

module.exports = router;
