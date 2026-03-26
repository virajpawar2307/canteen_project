const CanteenSetting = require('../models/CanteenSetting');

const seedCanteenSettings = async () => {
  const exists = await CanteenSetting.findOne({ key: 'default' });
  if (exists) return;

  await CanteenSetting.create({ key: 'default' });
};

module.exports = seedCanteenSettings;
