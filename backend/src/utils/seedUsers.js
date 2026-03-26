const bcrypt = require('bcryptjs');

const User = require('../models/User');

const SEED_USERS = [
  {
    username: 'ce@pict.edu',
    password: 'ce_coordinator@1111',
    role: 'coordinator',
    department: 'ce',
    displayName: 'CE Coordinator',
  },
  {
    username: 'it@pict.edu',
    password: 'it_coordinator@1111',
    role: 'coordinator',
    department: 'it',
    displayName: 'IT Coordinator',
  },
  {
    username: 'aids@pict.edu',
    password: 'aids_coordinator@1111',
    role: 'coordinator',
    department: 'aids',
    displayName: 'AIDS Coordinator',
  },
  {
    username: 'ece@pict.edu',
    password: 'ece_coordinator@1111',
    role: 'coordinator',
    department: 'ece',
    displayName: 'ECE Coordinator',
  },
  {
    username: 'entc@pict.edu',
    password: 'entc_coordinator@1111',
    role: 'coordinator',
    department: 'entc',
    displayName: 'ENTC Coordinator',
  },
  {
    username: 'canteen_manager@pict.edu',
    password: 'canteen_manager@1111',
    role: 'canteen_manager',
    department: null,
    displayName: 'Canteen Manager',
  },
];

const seedDefaultUsers = async () => {
  for (const seedUser of SEED_USERS) {
    const existing = await User.findOne({ username: seedUser.username });
    if (existing) continue;

    const passwordHash = await bcrypt.hash(seedUser.password, 10);
    await User.create({
      username: seedUser.username,
      passwordHash,
      role: seedUser.role,
      department: seedUser.department,
      displayName: seedUser.displayName,
    });
  }
};

module.exports = seedDefaultUsers;
