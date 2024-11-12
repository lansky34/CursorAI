const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    required: true
  },
  sentimentScore: {
    type: Number,
    default: 0,
    min: -1,
    max: 1
  },
  visitCount: {
    type: Number,
    default: 0,
    min: 0
  },
  badges: [{
    type: String,
    enum: ['TopRated', 'Trending', 'Hidden Gem', 'Local Favorite', 'New']
  }],
  aspectSentiment: {
    type: Map,
    of: {
      score: {
        type: Number,
        min: -1,
        max: 1
      },
      count: {
        type: Number,
        min: 0
      }
    },
    default: new Map()
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
businessSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Business = mongoose.model('Business', businessSchema);

module.exports = Business; 