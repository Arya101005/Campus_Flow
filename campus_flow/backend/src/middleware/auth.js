const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const JWT_SECRET = '7b03cba904ec61a688e3b035b85fc0aa618f6b7cd51cdf5685f1ac357a7d9434c092a4a6d9685e52e854c8c0523195f60e5d56aa1a5abdfd1de37ffc04cc1e91';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findOne({ _id: decoded.id, isActive: true });

    if (!admin) {
      throw new Error();
    }

    req.token = token;
    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ 
      status: 'error',
      message: 'Please authenticate.' 
    });
  }
};

const generateToken = (adminId) => {
  return jwt.sign({ id: adminId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get admin from token
      const admin = await Admin.findById(decoded.id).select('-password');
      if (!admin) {
        return res.status(401).json({
          status: 'error',
          message: 'Admin not found'
        });
      }

      // Add admin to request object
      req.admin = admin;
      next();
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error authenticating request'
    });
  }
};

module.exports = {
  protect,
  generateToken
}; 