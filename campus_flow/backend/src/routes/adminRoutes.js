const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/signup', adminController.signup);
router.post('/login', adminController.login);

// Protected routes
router.get('/profile', protect, adminController.getProfile);

module.exports = router; 