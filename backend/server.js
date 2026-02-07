const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const adminRoutes = require('./routes/admin.routes');
const teacherRoutes = require('./routes/teacher.routes');
const Student = require('./models/student.model');
const Teacher = require('./models/teacher.model');
const Admin = require('./models/admin.model');
const Class = require('./models/class.model');
const Event = require('./models/event.model');
const Task = require('./models/task.model');

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
app.use('/api/teachers', teacherRoutes);

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

// Events API routes
app.get('/api/events/all', async (req, res) => {
    try {
        const events = await Event.find();
        res.json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.json([]); // Return empty array on error
    }
});

app.post('/api/events/add', async (req, res) => {
    try {
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
        await Event.findByIdAndDelete(req.params.eventId);
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Error deleting event' });
    }
});

// Classes API routes
app.get('/api/classes/all', async (req, res) => {
    try {
        const classes = await Class.find().populate('students').populate('teacherId');
        res.json(classes);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.json([]); // Return empty array on error
    }
});

// Tasks API routes
app.get('/api/tasks/class/:classId', async (req, res) => {
    try {
        const tasks = await Task.find({ class: req.params.classId }).populate('teacherId class');
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.json([]); // Return empty array on error
    }
});

app.get('/api/tasks/teacher', async (req, res) => {
    try {
        const tasks = await Task.find().populate('class');
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.json([]); // Return empty array on error
    }
});

app.post('/api/tasks/create', async (req, res) => {
    try {
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
        res.json({ message: 'Task submitted successfully' });
    } catch (error) {
        console.error('Error submitting task:', error);
        res.status(500).json({ message: 'Error submitting task' });
    }
});

app.get('/api/tasks/:taskId/submissions', async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId).populate('submissions.studentId');
        res.json(task?.submissions || []);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.json([]); // Return empty array on error
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

// MongoDB and Server Start
const startServer = () => {
    mongoose.connect(config.MONGODB_URI)
        .then(() => {
            console.log('Connected to MongoDB');
            app.listen(config.PORT, () => {
                console.log(`Server is running on port ${config.PORT}`);
            });
        })
        .catch(err => {
            console.error('MongoDB connection error:', err);
            console.log('Starting server without MongoDB for frontend testing...');
            app.listen(config.PORT, () => {
                console.log(`Server is running on port ${config.PORT} (without MongoDB)`);
            });
        });
};

startServer();
