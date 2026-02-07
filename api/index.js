// Vercel Serverless API with MongoDB + Demo Mode
const mongoose = require('mongoose');
const config = require('../backend/config');

// Demo credentials (work without MongoDB)
const DEMO_USERS = {
    'admin@campusflow.in': { password: 'admin123', role: 'admin', name: 'Campus Admin', id: 'demo-admin-1' },
    'student@campusflow.in': { password: 'student123', role: 'student', name: 'Demo Student', id: 'demo-student-1', rollNumber: 'DEMO001', department: 'CSE', year: 2024 },
    'teacher@campusflow.in': { password: 'teacher123', role: 'teacher', name: 'Demo Teacher', id: 'demo-teacher-1', department: 'CSE', employeeId: 'DEMO001' },
    'aryan.singh@campusflow.in': { password: 'student123', role: 'student', name: 'Aryan Singh', id: 'demo-student-2', rollNumber: 'CSE001', department: 'CSE', year: 2024 },
    'rajesh.kumar@campusflow.in': { password: 'teacher123', role: 'teacher', name: 'Dr. Rajesh Kumar', id: 'demo-teacher-2', department: 'CSE', employeeId: 'T001' }
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
const Task = mongoose.models.Task || require('../backend/models/task.model');
const Class = mongoose.models.Class || require('../backend/models/class.model');

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
    
    // Parse URL path for API routing
    const urlPath = url.split('?')[0];
    const pathParts = urlPath.split('/').filter(p => p);
    
    try {
        // Health check
        if (method === 'GET' && urlPath === '/api/health') {
            return res.json({ status: 'ok', message: 'Server is running', mode: cachedConnection ? 'MongoDB' : 'Demo' });
        }

        // Login endpoint
        if (method === 'POST' && urlPath === '/api/login') {
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
                        role: role,
                        rollNumber: demoUser.rollNumber,
                        department: demoUser.department,
                        year: demoUser.year,
                        employeeId: demoUser.employeeId
                    }
                });
            }

            // Try MongoDB if demo fails
            const db = await connectToDatabase();
            if (!db) {
                return res.status(401).json({ message: 'Invalid credentials. Use demo: student@campusflow.in / student123' });
            }

            let user;
            if (role === 'student') user = await Student.findOne({ email }).select('+password');
            else if (role === 'teacher') user = await Teacher.findOne({ email }).select('+password');
            else if (role === 'admin') user = await Admin.findOne({ email }).select('+password');
            else return res.status(400).json({ message: 'Invalid role' });

            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ id: user._id, role }, config.JWT_SECRET, { expiresIn: '1d' });
            user.password = undefined;

            return res.json({ 
                token, 
                user: { 
                    id: user._id, 
                    name: user.name, 
                    email: user.email, 
                    role,
                    rollNumber: user.rollNumber,
                    department: user.department,
                    year: user.year,
                    employeeId: user.employeeId
                } 
            });
        }

        // Admin Signup
        if (method === 'POST' && urlPath === '/api/admin/signup') {
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

        // Get all classes (Admin/Teacher)
        if (method === 'GET' && urlPath === '/api/classes/all') {
            const db = await connectToDatabase();
            if (!db) {
                // Return demo classes in demo mode
                return res.json([
                    { _id: 'demo-1', name: 'CSE_A_2024', department: 'CSE', year: 2024, studentCount: 8 },
                    { _id: 'demo-2', name: 'CSE_B_2024', department: 'CSE', year: 2024, studentCount: 6 },
                    { _id: 'demo-3', name: 'ECE_A_2024', department: 'ECE', year: 2024, studentCount: 4 }
                ]);
            }
            const classes = await Class.find().populate('students', 'name email rollNumber');
            const classesWithCount = classes.map(c => ({
                ...c.toObject(),
                studentCount: c.students?.length || 0
            }));
            return res.json(classesWithCount);
        }

        // Get all students (Admin)
        if (method === 'GET' && urlPath === '/api/students/all') {
            const db = await connectToDatabase();
            if (!db) {
                return res.json([
                    { _id: 'demo-s1', name: 'Aryan Singh', email: 'aryan.singh@campusflow.in', rollNumber: 'CSE001', department: 'CSE', year: 2024, className: 'CSE_A_2024' },
                    { _id: 'demo-s2', name: 'Ananya Gupta', email: 'ananya.gupta@campusflow.in', rollNumber: 'CSE002', department: 'CSE', year: 2024, className: 'CSE_A_2024' },
                    { _id: 'demo-s3', name: 'Arjun Mehta', email: 'arjun.mehta@campusflow.in', rollNumber: 'CSE003', department: 'CSE', year: 2024, className: 'CSE_A_2024' },
                    { _id: 'demo-s4', name: 'Avni Joshi', email: 'avni.joshi@campusflow.in', rollNumber: 'CSE004', department: 'CSE', year: 2024, className: 'CSE_A_2024' },
                    { _id: 'demo-s5', name: 'Karan Desai', email: 'karan.desai@campusflow.in', rollNumber: 'CSE009', department: 'CSE', year: 2024, className: 'CSE_B_2024' }
                ]);
            }
            const students = await Student.find().populate('class', 'name');
            const studentsWithClass = students.map(s => ({
                ...s.toObject(),
                className: s.class?.name || 'N/A'
            }));
            return res.json(studentsWithClass);
        }

        // Get all teachers (Admin)
        if (method === 'GET' && urlPath === '/api/teachers/all') {
            const db = await connectToDatabase();
            if (!db) {
                return res.json([
                    { _id: 'demo-t1', name: 'Dr. Rajesh Kumar', email: 'rajesh.kumar@campusflow.in', department: 'CSE', employeeId: 'T001' },
                    { _id: 'demo-t2', name: 'Prof. Priya Sharma', email: 'priya.sharma@campusflow.in', department: 'CSE', employeeId: 'T002' },
                    { _id: 'demo-t3', name: 'Dr. Amit Patel', email: 'amit.patel@campusflow.in', department: 'ECE', employeeId: 'T003' }
                ]);
            }
            const teachers = await Teacher.find();
            return res.json(teachers);
        }

        // Events endpoints
        if (method === 'GET' && urlPath === '/api/events/all') {
            const db = await connectToDatabase();
            if (!db) {
                return res.json([
                    { _id: 'demo-e1', title: 'Annual Tech Fest 2024', description: 'Biggest tech event of the year', deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), formLink: 'https://forms.google.com/tech-fest' },
                    { _id: 'demo-e2', title: 'Placement Drive - Tech Corp', description: 'On-campus placement opportunity', deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), formLink: 'https://forms.google.com/placement' },
                    { _id: 'demo-e3', title: 'Workshop: AI & Machine Learning', description: 'Hands-on workshop on AI/ML', deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), formLink: 'https://forms.google.com/ai-workshop' }
                ]);
            }
            const events = await Event.find().sort({ deadline: 1 });
            return res.json(events);
        }

        if (method === 'POST' && urlPath === '/api/events/add') {
            const { title, description, deadline, formLink } = req.body;
            
            const db = await connectToDatabase();
            if (!db) {
                return res.status(201).json({ message: 'Event created (demo mode)', event: { _id: 'demo-new-' + Date.now(), title, description, deadline, formLink } });
            }

            const event = new Event({ title, description, deadline, formLink });
            await event.save();

            return res.status(201).json({ message: 'Event created', event });
        }

        // Delete event
        if (method === 'DELETE' && pathParts[1] === 'api' && pathParts[2] === 'events' && pathParts[3]) {
            const eventId = pathParts[3];
            
            const db = await connectToDatabase();
            if (!db) {
                return res.json({ message: 'Event deleted (demo mode)' });
            }

            await Event.findByIdAndDelete(eventId);
            return res.json({ message: 'Event deleted' });
        }

        // Tasks endpoints
        if (method === 'GET' && urlPath === '/api/tasks/all') {
            const db = await connectToDatabase();
            if (!db) {
                return res.json([
                    { _id: 'demo-tk1', title: 'Binary Search Tree Implementation', description: 'Implement BST with insert, delete, search', type: 'document', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), className: 'CSE_A_2024', teacherName: 'Dr. Rajesh Kumar' },
                    { _id: 'demo-tk2', title: 'SQL Query Practice', description: 'Solve SQL queries', type: 'form', deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), className: 'CSE_A_2024', teacherName: 'Prof. Priya Sharma' },
                    { _id: 'demo-tk3', title: 'Hackathon 2024', description: 'Annual coding hackathon', type: 'hackathon', deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), className: 'CSE_A_2024', teacherName: 'Dr. Rajesh Kumar' },
                    { _id: 'demo-tk4', title: 'Algorithms Quiz', description: 'Online quiz on sorting algorithms', type: 'quiz', deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), className: 'CSE_B_2024', teacherName: 'Dr. Rajesh Kumar' }
                ]);
            }
            const tasks = await Task.find().populate('class', 'name').populate('teacherId', 'name');
            const tasksWithDetails = tasks.map(t => ({
                ...t.toObject(),
                className: t.class?.name || 'N/A',
                teacherName: t.teacherId?.name || 'N/A'
            }));
            return res.json(tasksWithDetails);
        }

        if (method === 'GET' && urlPath === '/api/tasks/teacher') {
            const db = await connectToDatabase();
            if (!db) {
                return res.json([
                    { _id: 'demo-tk1', title: 'Binary Search Tree Implementation', description: 'Implement BST with insert, delete, search', type: 'document', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), className: 'CSE_A_2024' },
                    { _id: 'demo-tk2', title: 'SQL Query Practice', description: 'Solve SQL queries', type: 'form', deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), className: 'CSE_A_2024' },
                    { _id: 'demo-tk3', title: 'Hackathon 2024', description: 'Annual coding hackathon', type: 'hackathon', deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), className: 'CSE_A_2024' }
                ]);
            }
            const tasks = await Task.find().populate('class', 'name');
            const tasksWithDetails = tasks.map(t => ({
                ...t.toObject(),
                className: t.class?.name || 'N/A'
            }));
            return res.json(tasksWithDetails);
        }

        if (method === 'POST' && urlPath === '/api/tasks/create') {
            const { title, description, type, deadline, classId, formLink, fileUrl } = req.body;
            
            const db = await connectToDatabase();
            if (!db) {
                return res.status(201).json({ message: 'Task created (demo mode)', task: { _id: 'demo-task-' + Date.now(), title, description, type, deadline } });
            }

            const task = new Task({ title, description, type, deadline, class: classId, formLink, fileUrl });
            await task.save();

            return res.status(201).json({ message: 'Task created', task });
        }

        return res.status(404).json({ message: 'Endpoint not found: ' + urlPath });

    } catch (error) {
        console.error('Server error:', error.message);
        return res.status(500).json({ message: 'Server error: ' + error.message });
    }
};
