const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/userController');
const { auth } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', auth, getProfile);

module.exports = router; 