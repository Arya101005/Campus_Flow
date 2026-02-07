const mongoose = require('mongoose');
const config = require('../backend/config');

// MongoDB connection for serverless
let isConnected = false;

async function connectDB() {
    if (isConnected) {
        return mongoose;
    }
    
    try {
        // Check if already connected
        if (mongoose.connection.readyState === 1) {
            isConnected = true;
            return mongoose;
        }
        
        await mongoose.connect(config.MONGODB_URI, {
            bufferCommands: false,
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
        });
        
        isConnected = true;
        console.log('MongoDB connected');
        return mongoose;
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        throw error;
    }
}

// Import models AFTER mongoose is defined
const Student = mongoose.models.Student || require('../backend/models/student.model');
const Teacher = mongoose.models.Teacher || require('../backend/models/teacher.model');
const Admin = mongoose.models.Admin || require('../backend/models/admin.model');
const Class = mongoose.models.Class || require('../backend/models/class.model');
const Event = mongoose.models.Event || require('../backend/models/event.model');
const Task = mongoose.models.Task || require('../backend/models/task.model');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
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
            return res.json({ status: 'ok', message: 'Server is running' });
        }

        // Login endpoint
        if (method === 'POST' && url === '/api/login') {
            const { email, password, role } = req.body;
            
            if (!email || !password || !role) {
                return res.status(400).json({ message: 'Email, password, and role are required' });
            }

            await connectDB();
            
            let user = null;
            if (role === 'student') user = await Student.findOne({ email });
            else if (role === 'teacher') user = await Teacher.findOne({ email });
            else if (role === 'admin') user = await Admin.findOne({ email });
            else return res.status(400).json({ message: 'Invalid role specified' });

            if (!user) return res.status(400).json({ message: 'Invalid credentials' });

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ id: user._id, role }, config.JWT_SECRET, { expiresIn: '1d' });

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

            await connectDB();
            
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

            await connectDB();
            
            const admin = await Admin.findOne({ email });
            if (!admin) return res.status(400).json({ message: 'Invalid credentials' });

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ id: admin._id, role: 'admin' }, config.JWT_SECRET, { expiresIn: '1d' });

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

            await connectDB();
            
            const teacher = await Teacher.findOne({ email });
            if (!teacher) return res.status(400).json({ message: 'Invalid credentials' });

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, teacher.password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ id: teacher._id, role: 'teacher' }, config.JWT_SECRET, { expiresIn: '1d' });

            return res.json({
                token,
                teacher: { id: teacher._id, name: teacher.name, email: teacher.email, department: teacher.department, employeeId: teacher.employeeId }
            });
        }

        // Events endpoints
        if (method === 'GET' && url === '/api/events/all') {
            await connectDB();
            const events = await Event.find();
            return res.json(events);
        }

        if (method === 'POST' && url === '/api/events/add') {
            await connectDB();
            const { title, description, deadline, formLink } = req.body;
            const event = new Event({ title, description, deadline, formLink });
            await event.save();
            return res.json({ message: 'Event created successfully', event });
        }

        // Classes endpoint
        if (method === 'GET' && url === '/api/classes/all') {
            await connectDB();
            const classes = await Class.find().populate('students').populate('teacherId');
            return res.json(classes);
        }

        // Tasks endpoints
        if (method === 'GET' && url === '/api/tasks/teacher') {
            await connectDB();
            const tasks = await Task.find().populate('class');
            return res.json(tasks);
        }

        if (method === 'POST' && url === '/api/tasks/create') {
            await connectDB();
            const task = new Task(req.body);
            await task.save();
            return res.json({ message: 'Task created successfully', task });
        }

        return res.status(404).json({ message: 'Endpoint not found' });

    } catch (error) {
        console.error('Server error:', error.message);
        return res.status(500).json({ message: 'Server error: ' + error.message });
    }
};
