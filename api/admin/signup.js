const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../backend/config');
const Admin = require('../../backend/models/admin.model');
const Student = require('../../backend/models/student.model');
const Teacher = require('../../backend/models/teacher.model');
const Subject = require('../../backend/models/subject.model');
const Timetable = require('../../backend/models/timetable.model');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const Class = require('../../backend/models/class.model');
const User = require('../../backend/models/user.model');

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Helper function to generate email and a default password
const generateCredentials = (name, role = 'student') => {
    const nameParts = name.toLowerCase().split(' ').filter(part => part.length > 0);
    const baseEmail = nameParts.join('.');
    const email = `${baseEmail}@campusflow.in`;
    const defaultPassword = 'Welcome123!'; 
    return { email, defaultPassword };
};

// Admin Signup
router.post('/signup', async (req, res) => {
    try {
        console.log('Received signup request:', req.body);
        const { name, email, department, password } = req.body;

        if (!name || !email || !department || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = new Admin({
            name,
            email,
            department,
            password: hashedPassword
        });

        await admin.save();
        console.log('Admin registered successfully:', email);

        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        console.error('Admin signup error:', error);
        res.status(500).json({ message: 'Error registering admin: ' + error.message });
    }
});

// Admin Login
router.post('/login', async (req, res) => {
    try {
        console.log('Received login request:', req.body);
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin._id, role: 'admin' },
            config.JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log('Admin logged in successfully:', email);

        res.json({
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                department: admin.department
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Error logging in: ' + error.message });
    }
});

module.exports = router;
