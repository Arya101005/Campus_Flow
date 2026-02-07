// Vercel Serverless API with MongoDB + Demo Mode
const mongoose = require('mongoose');
const config = require('../backend/config');

// Demo credentials (work without MongoDB)
const DEMO_USERS = {
    'student@campusflow.in': { password: 'student123', role: 'student', name: 'John Student', id: 'demo-student-1' },
    'teacher@campusflow.in': { password: 'teacher123', role: 'teacher', name: 'Sarah Teacher', id: 'demo-teacher-1' },
    'admin@campusflow.in': { password: 'admin123', role: 'admin', name: 'Admin User', id: 'demo-admin-1' }
};

// Connection cache
let cachedConnection = null;

async function connectToDatabase() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    const uri = process.env.MONGODB_URI || config.MONGODB_URI;
    
    try {
        mongoose.set('bufferCommands', false);
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 3000,
            socketTimeoutMS: 5000,
            maxPoolSize: 1,
        });
        cachedConnection = mongoose;
        console.log('MongoDB connected');
        return cachedConnection;
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        cachedConnection = null;
        return null;
    }
}

// Import models
const Student = mongoose.models.Student || require('../backend/models/student.model');
const Teacher = mongoose.models.Teacher || require('../backend/models/teacher.model');
const Admin = mongoose.models.Admin || require('../backend/models/admin.model');
const Event = mongoose.models.Event || require('../backend/models/event.model');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method, url } = req;

    try {
        // Health check
        if (method === 'GET' && url === '/api/health') {
            return res.json({ status: 'ok', message: 'Server is running', mode: cachedConnection ? 'MongoDB' : 'Demo' });
        }

        // Login endpoint with Demo Mode
        if (method === 'POST' && url === '/api/login') {
            const { email, password, role } = req.body;
            
            if (!email || !password || !role) {
                return res.status(400).json({ message: 'Email, password, and role are required' });
            }

            // Check demo credentials first
            const demoUser = DEMO_USERS[email];
            if (demoUser && demoUser.password === password && demoUser.role === role) {
                console.log('Demo login successful:', email);
                return res.json({
                    token: 'demo-token-' + Date.now(),
                    user: {
                        id: demoUser.id,
                        name: demoUser.name,
                        email: email,
                        role: role
                    }
                });
            }

            // Try MongoDB if demo fails
            const db = await connectToDatabase();
            if (!db) {
                return res.status(503).json({ message: 'Demo: Use student@campusflow.in / student123 for demo access' });
            }

            let user;
            if (role === 'student') user = await Student.findOne({ email }).select('+password');
            else if (role === 'teacher') user = await Teacher.findOne({ email }).select('+password');
            else if (role === 'admin') user = await Admin.findOne({ email }).select('+password');
            else return res.status(400).json({ message: 'Invalid role' });

            if (!user) {
                return res.status(400).json({ message: 'Invalid credentials. Try demo: student@campusflow.in / student123' });
            }

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ id: user._id, role }, config.JWT_SECRET, { expiresIn: '1d' });
            user.password = undefined;

            return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role } });
        }

        // Admin Signup
        if (method === 'POST' && url === '/api/admin/signup') {
            const { name, email, department, password } = req.body;
            
            if (!name || !email || !department || !password) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            const db = await connectToDatabase();
            if (!db) {
                return res.status(503).json({ message: 'Demo mode: Cannot create new users. MongoDB connection required.' });
            }

            const existingAdmin = await Admin.findOne({ email });
            if (existingAdmin) {
                return res.status(400).json({ message: 'Admin with this email already exists' });
            }

            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const admin = new Admin({ name, email, department, password: hashedPassword });
            await admin.save();

            return res.status(201).json({ message: 'Admin registered successfully' });
        }

        // Events endpoints (Demo mode returns empty)
        if (method === 'GET' && url === '/api/events/all') {
            return res.json([]);
        }

        if (method === 'POST' && url === '/api/events/add') {
            return res.json({ message: 'Event created (demo mode)', event: req.body });
        }

        return res.status(404).json({ message: 'Endpoint not found' });

    } catch (error) {
        console.error('Server error:', error.message);
        return res.status(500).json({ message: 'Server error: ' + error.message });
    }
};
