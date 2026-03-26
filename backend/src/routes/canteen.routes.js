const express = require('express');
const { body } = require('express-validator');

const {
  createMenuItem,
  deleteMenuItem,
  getMenuAndSettings,
  getOrders,
  getReportData,
  processOrder,
  updateMenuItem,
  updateCategorySettings,
} = require('../controllers/canteen.controller');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth, requireRole('canteen_manager'));

router.get('/orders', getOrders);
router.patch('/orders/:orderId/process', processOrder);
router.get('/menu', getMenuAndSettings);
router.put('/menu/settings', updateCategorySettings);
router.post(
  '/menu/items',
  [
    body('name').trim().notEmpty().withMessage('Item name is required'),
    body('category').isIn(['Breakfast', 'Lunch', 'Beverage', 'Snacks']).withMessage('Invalid category'),
    body('price').isNumeric().withMessage('Price must be numeric'),
  ],
  createMenuItem
);
router.put(
  '/menu/items/:itemId',
  [
    body('name').trim().notEmpty().withMessage('Item name is required'),
    body('category').isIn(['Breakfast', 'Lunch', 'Beverage', 'Snacks']).withMessage('Invalid category'),
    body('price').isNumeric().withMessage('Price must be numeric'),
  ],
  updateMenuItem
);
router.delete('/menu/items/:itemId', deleteMenuItem);
router.get('/reports', getReportData);

module.exports = router;
