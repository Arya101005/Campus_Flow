const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const config = require('../backend/config');

// Import models
const Student = require('../backend/models/student.model');
const Teacher = require('../backend/models/teacher.model');
const Admin = require('../backend/models/admin.model');
const Class = require('../backend/models/class.model');
const Event = require('../backend/models/event.model');
const Task = require('../backend/models/task.model');
const Subject = require('../backend/models/subject.model');
const Timetable = require('../backend/models/timetable.model');

// Create Express app
const app = express();

// CORS configuration
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// MongoDB connection helper for serverless
let mongoose = null;
async function getDB() {
    if (mongoose && mongoose.connection.readyState === 1) {
        return mongoose;
    }
    
    try {
        mongoose = require('mongoose');
        if (!mongoose.connection.readyState) {
            await mongoose.connect(config.MONGODB_URI, {
                bufferCommands: false,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
        }
        return mongoose;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        return null;
    }
}

// Helper function to generate credentials
function generateCredentials(name, role = 'student') {
    const nameParts = name.toLowerCase().split(' ').filter(part => part.length > 0);
    const baseEmail = nameParts.join('.');
    const email = `${baseEmail}@campusflow.in`;
    const defaultPassword = 'Welcome123!';
    return { email, defaultPassword };
}

// ==================== AUTH ROUTES ====================

// Login route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password || !role) {
            return res.status(400).json({ message: 'Email, password, and role are required' });
        }

        await getDB();
        let user = null;

        switch (role) {
            case 'student': user = await Student.findOne({ email }); break;
            case 'teacher': user = await Teacher.findOne({ email }); break;
            case 'admin': user = await Admin.findOne({ email }); break;
            default: return res.status(400).json({ message: 'Invalid role specified' });
        }

        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, role }, config.JWT_SECRET, { expiresIn: '1d' });

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

// ==================== ADMIN ROUTES ====================

// Admin Signup
app.post('/api/admin/signup', async (req, res) => {
    try {
        await getDB();
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

        const admin = new Admin({ name, email, department, password: hashedPassword });
        await admin.save();

        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        console.error('Admin signup error:', error);
        res.status(500).json({ message: 'Error registering admin: ' + error.message });
    }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        await getDB();
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

        const token = jwt.sign({ id: admin._id, role: 'admin' }, config.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            token,
            admin: { id: admin._id, name: admin.name, email: admin.email, department: admin.department }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Error logging in: ' + error.message });
    }
});

// ==================== TEACHER ROUTES ====================

// Teacher Login
app.post('/api/teachers/login', async (req, res) => {
    try {
        await getDB();
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, teacher.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: teacher._id, role: 'teacher' }, config.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            token,
            teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                department: teacher.department,
                employeeId: teacher.employeeId
            }
        });
    } catch (error) {
        console.error('Teacher login error:', error);
        res.status(500).json({ message: 'Error logging in: ' + error.message });
    }
});

// ==================== EVENTS ROUTES ====================

app.get('/api/events/all', async (req, res) => {
    try {
        await getDB();
        const events = await Event.find();
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.json([]);
    }
});

app.post('/api/events/add', async (req, res) => {
    try {
        await getDB();
        const { title, description, deadline, formLink } = req.body;
        const event = new Event({ title, description, deadline, formLink });
        await event.save();
        res.json({ message: 'Event created successfully', event });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Error creating event' });
    }
});

app.delete('/api/events/:eventId', async (req, res) => {
    try {
        await getDB();
        await Event.findByIdAndDelete(req.params.eventId);
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Error deleting event' });
    }
});

// ==================== CLASSES ROUTES ====================

app.get('/api/classes/all', async (req, res) => {
    try {
        await getDB();
        const classes = await Class.find().populate('students').populate('teacherId');
        res.json(classes);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.json([]);
    }
});

// ==================== TASKS ROUTES ====================

app.get('/api/tasks/class/:classId', async (req, res) => {
    try {
        await getDB();
        const tasks = await Task.find({ class: req.params.classId }).populate('teacherId class');
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.json([]);
    }
});

app.get('/api/tasks/teacher', async (req, res) => {
    try {
        await getDB();
        const tasks = await Task.find().populate('class');
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.json([]);
    }
});

app.post('/api/tasks/create', async (req, res) => {
    try {
        await getDB();
        const task = new Task(req.body);
        await task.save();
        res.json({ message: 'Task created successfully', task });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Error creating task' });
    }
});

app.post('/api/tasks/:taskId/submit', async (req, res) => {
    try {
        await getDB();
        res.json({ message: 'Task submitted successfully' });
    } catch (error) {
        console.error('Error submitting task:', error);
        res.status(500).json({ message: 'Error submitting task' });
    }
});

app.get('/api/tasks/:taskId/submissions', async (req, res) => {
    try {
        await getDB();
        const task = await Task.findById(req.params.taskId).populate('submissions.studentId');
        res.json(task?.submissions || []);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.json([]);
    }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Export handler for Vercel
module.exports = app;
