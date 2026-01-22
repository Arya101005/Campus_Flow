const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const adminRoutes = require('./routes/admin.routes');
const Student = require('./models/student.model');
const Teacher = require('./models/teacher.model');
const Admin = require('./models/admin.model');

// Create Express app
const app = express();

// CORS configuration
app.use(cors({
    origin: ['http://localhost:5501', 'http://127.0.0.1:5501'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/admin', adminRoutes);

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    // const authHeader = req.headers.authorization;
    // const token = authHeader?.split(' ')[1];

    // if (!token) {
    //     return res.status(401).json({ message: 'No token provided' });
    // }

    // try {
    //     const decoded = jwt.verify(token, config.JWT_SECRET);
    //     req.user = decoded;
        next(); // Temporarily allow all requests to pass
    // } catch (error) {
    //     return res.status(401).json({ message: 'Invalid token' });
    // }
};

// Login route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ message: 'Email, password, and role are required' });
        }

        let user = null;

        switch (role) {
            case 'student':
                user = await Student.findOne({ email });
                break;
            case 'teacher':
                user = await Teacher.findOne({ email });
                break;
            case 'admin':
                user = await Admin.findOne({ email });
                break;
            default:
                return res.status(400).json({ message: 'Invalid role specified' });
        }

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, role },
            config.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: role,
                ...(role === 'student' && { rollNumber: user.rollNumber, department: user.department, class: user.class, year: user.year }),
                ...(role === 'teacher' && { department: user.department, employeeId: user.employeeId })
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Serve Protected dashboards (frontend handles token verification)
app.get('/studentDashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/studentDashboard.html'));
});

app.get('/teacherDashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/teacherDashboard.html'));
});

app.get('/adminDashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/adminDashboard.html'));
});

// Basic routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Catch-all route for frontend routes (send login page)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// API routes that require token verification (Example: you will need to add your actual API endpoints here)
// app.get('/api/student/data', verifyToken, (req, res) => { ... });
// app.get('/api/teacher/classes', verifyToken, (req, res) => { ... });
// app.get('/api/admin/users', verifyToken, (req, res) => { ... });

// MongoDB and Server Start
const startServer = () => {
    // Health check route
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', message: 'Server is running' });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        console.error('Error:', err);
        res.status(500).json({ 
            message: 'Something went wrong!',
            error: err.message 
        });
    });

    // Connect to MongoDB
    mongoose.connect(config.MONGODB_URI)
        .then(() => {
            console.log('Connected to MongoDB');
            app.listen(config.PORT, () => {
                console.log(`Server is running on port ${config.PORT}`);
            });
        })
        .catch(err => {
            console.error('MongoDB connection error:', err);
            process.exit(1);
        });
};

startServer();
