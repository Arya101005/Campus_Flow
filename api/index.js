// Vercel Serverless API with MongoDB
// Optimized for Vercel's serverless environment

const mongoose = require('mongoose');
const config = require('../backend/config');

// Connection cache
let cachedConnection = null;

async function connectToDatabase() {
    // Return cached connection if available
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
        console.log('MongoDB connected successfully');
        return cachedConnection;
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        cachedConnection = null;
        throw error;
    }
}

// Import models after mongoose is set up
const Student = mongoose.models.Student || require('../backend/models/student.model');
const Teacher = mongoose.models.Teacher || require('../backend/models/teacher.model');
const Admin = mongoose.models.Admin || require('../backend/models/admin.model');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method, url } = req;

    try {
        // Health check - no DB needed
        if (method === 'GET' && url === '/api/health') {
            return res.json({ status: 'ok', message: 'Server is running' });
        }

        // Connect to database for all other endpoints
        await connectToDatabase();

        // Login endpoint
        if (method === 'POST' && url === '/api/login') {
            const { email, password, role } = req.body;
            
            if (!email || !password || !role) {
                return res.status(400).json({ message: 'Email, password, and role are required' });
            }

            let user;
            if (role === 'student') {
                user = await Student.findOne({ email }).select('+password');
            } else if (role === 'teacher') {
                user = await Teacher.findOne({ email }).select('+password');
            } else if (role === 'admin') {
                user = await Admin.findOne({ email }).select('+password');
            } else {
                return res.status(400).json({ message: 'Invalid role specified' });
            }

            if (!user) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { id: user._id, role },
                config.JWT_SECRET,
                { expiresIn: '1d' }
            );

            // Remove password from response
            user.password = undefined;

            return res.json({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: role,
                    ...(role === 'student' && { rollNumber: user.rollNumber, department: user.department }),
                    ...(role === 'teacher' && { department: user.department, employeeId: user.employeeId })
                }
            });
        }

        // Admin Signup
        if (method === 'POST' && url === '/api/admin/signup') {
            const { name, email, department, password } = req.body;
            
            if (!name || !email || !department || !password) {
                return res.status(400).json({ message: 'All fields are required' });
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

        // Admin Login
        if (method === 'POST' && url === '/api/admin/login') {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }

            const admin = await Admin.findOne({ email }).select('+password');
            if (!admin) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { id: admin._id, role: 'admin' },
                config.JWT_SECRET,
                { expiresIn: '1d' }
            );

            admin.password = undefined;

            return res.json({
                token,
                admin: { id: admin._id, name: admin.name, email: admin.email, department: admin.department }
            });
        }

        // Teacher Login
        if (method === 'POST' && url === '/api/teachers/login') {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }

            const teacher = await Teacher.findOne({ email }).select('+password');
            if (!teacher) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, teacher.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { id: teacher._id, role: 'teacher' },
                config.JWT_SECRET,
                { expiresIn: '1d' }
            );

            teacher.password = undefined;

            return res.json({
                token,
                teacher: { id: teacher._id, name: teacher.name, email: teacher.email, department: teacher.department, employeeId: teacher.employeeId }
            });
        }

        // Events endpoints (simplified)
        if (method === 'GET' && url === '/api/events/all') {
            const Event = mongoose.models.Event || require('../backend/models/event.model');
            const events = await Event.find();
            return res.json(events);
        }

        if (method === 'POST' && url === '/api/events/add') {
            const Event = mongoose.models.Event || require('../backend/models/event.model');
            const { title, description, deadline, formLink } = req.body;
            const event = new Event({ title, description, deadline, formLink });
            await event.save();
            return res.json({ message: 'Event created successfully', event });
        }

        return res.status(404).json({ message: 'Endpoint not found' });

    } catch (error) {
        console.error('Server error:', error.message);
        
        // Handle specific errors
        if (error.message.includes('buffering timed out')) {
            return res.status(503).json({ 
                message: 'Database connection timeout. Please try again.',
                error: 'MongoDB timeout'
            });
        }
        
        if (error.message.includes('authentication failed')) {
            return res.status(401).json({ 
                message: 'Database authentication failed. Please check configuration.',
                error: 'Auth failed'
            });
        }

        return res.status(500).json({ 
            message: 'Server error. Please try again later.',
            error: error.message 
        });
    }
};
