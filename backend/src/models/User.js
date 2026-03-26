const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['coordinator', 'canteen_manager'],
      required: true,
    },
    department: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
