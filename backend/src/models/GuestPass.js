const mongoose = require('mongoose');

const guestPassSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: 'N/A', trim: true },
    phone: { type: String, required: true, trim: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    createdByVoucherCode: { type: String, required: true, uppercase: true, trim: true },
    createdByName: { type: String, required: true, trim: true },
    dept: { type: String, default: null, lowercase: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GuestPass', guestPassSchema);
