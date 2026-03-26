const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Breakfast', 'Lunch', 'Beverage', 'Snacks'],
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
