const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: 'N/A', trim: true },
    phone: { type: String, default: 'N/A', trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    type: { type: String, enum: ['Internal', 'External'], default: 'Internal' },
    items: { type: String, default: 'Pending' },
    amount: { type: Number, default: 0 },
    date: { type: String, required: true },
    dept: { type: String, required: true, lowercase: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Voucher', voucherSchema);
