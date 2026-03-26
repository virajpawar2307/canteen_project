const mongoose = require('mongoose');

const categorySettingSchema = new mongoose.Schema(
  {
    status: { type: Boolean, default: true },
    fromTime: { type: String, default: '08:30' },
    toTime: { type: String, default: '18:00' },
  },
  { _id: false }
);

const canteenSettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    categorySettings: {
      Breakfast: { type: categorySettingSchema, default: () => ({ status: true, fromTime: '08:30', toTime: '10:30' }) },
      Lunch: { type: categorySettingSchema, default: () => ({ status: true, fromTime: '12:30', toTime: '14:30' }) },
      Beverage: { type: categorySettingSchema, default: () => ({ status: true, fromTime: '08:30', toTime: '18:00' }) },
      Snacks: { type: categorySettingSchema, default: () => ({ status: true, fromTime: '10:30', toTime: '17:30' }) },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CanteenSetting', canteenSettingSchema);
