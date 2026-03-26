const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    voucherCode: { type: String, required: true, uppercase: true, trim: true },
    voucherType: { type: String, enum: ['Internal', 'External'], required: true },
    examinerName: { type: String, required: true, trim: true },
    dept: { type: String, default: null, lowercase: true, trim: true },
    items: { type: [orderItemSchema], default: [] },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Pending', 'Processed'], default: 'Pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
