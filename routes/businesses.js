const express = require('express');
const router = express.Router();
const Business = require('../models/business');

// Get all businesses
router.get('/', async (req, res) => {
  try {
    const businesses = await Business.find();
    res.json(businesses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get business by ID
router.get('/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    res.json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new business
router.post('/', async (req, res) => {
  const business = new Business({
    name: req.body.name,
    location: {
      latitude: req.body.location.latitude,
      longitude: req.body.location.longitude
    },
    badges: req.body.badges || [],
    aspectSentiment: req.body.aspectSentiment || new Map()
  });

  try {
    const newBusiness = await business.save();
    res.status(201).json(newBusiness);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 