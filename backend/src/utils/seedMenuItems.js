const MenuItem = require('../models/MenuItem');

const MENU_ITEMS = [
  { name: 'Special Thali', category: 'Lunch', price: 100 },
  { name: 'Mini Thali', category: 'Lunch', price: 80 },
  { name: 'Misal Pav', category: 'Breakfast', price: 50 },
  { name: 'Poha', category: 'Breakfast', price: 40 },
  { name: 'Cold Coffee', category: 'Beverage', price: 30 },
  { name: 'Tea', category: 'Beverage', price: 15 },
  { name: 'Samosa (2 pcs)', category: 'Snacks', price: 30 },
];

const seedMenuItems = async () => {
  for (const item of MENU_ITEMS) {
    const exists = await MenuItem.findOne({ name: item.name, category: item.category });
    if (exists) continue;
    await MenuItem.create(item);
  }
};

module.exports = seedMenuItems;
