require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const seedDefaultUsers = require('./utils/seedUsers');
const seedCanteenSettings = require('./utils/seedCanteenSettings');
const seedMenuItems = require('./utils/seedMenuItems');
const Voucher = require('./models/Voucher');

const PORT = process.env.PORT || 5000;

const ensureVoucherCodeIndex = async () => {
  try {
    const indexes = await Voucher.collection.indexes();
    const codeIndex = indexes.find((idx) => idx.name === 'code_1');

    if (codeIndex?.unique) {
      await Voucher.collection.dropIndex('code_1');
      await Voucher.collection.createIndex({ code: 1 }, { unique: false });
    } else if (!codeIndex) {
      await Voucher.collection.createIndex({ code: 1 }, { unique: false });
    }
  } catch (error) {
    console.warn('Voucher code index check skipped:', error.message);
  }
};

const startServer = async () => {
  try {
    await connectDB();
    await ensureVoucherCodeIndex();
    await seedDefaultUsers();
    await seedCanteenSettings();
    await seedMenuItems();
    console.log('Default staff users are ready (no voucher auto-seeding)');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
