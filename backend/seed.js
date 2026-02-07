const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');

// Import models
const Student = require('./models/student.model');
const Teacher = require('./models/teacher.model');
const Admin = require('./models/admin.model');
const Class = require('./models/class.model');
const Subject = require('./models/subject.model');
const Timetable = require('./models/timetable.model');
const Task = require('./models/task.model');
const Event = require('./models/event.model');

const seedData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(config.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Student.deleteMany({});
        await Teacher.deleteMany({});
        await Admin.deleteMany({});
        await Class.deleteMany({});
        await Subject.deleteMany({});
        await Timetable.deleteMany({});
        await Task.deleteMany({});
        await Event.deleteMany({});
        console.log('Cleared existing data');

        // Create Admin
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = await Admin.create({
            name: 'Campus Admin',
            email: 'admin@campusflow.in',
            department: 'Administration',
            password: adminPassword
        });
        console.log('Created admin:', admin.email);

        // Create Teachers
        const teacherPassword = await bcrypt.hash('teacher123', 10);
        const teachers = await Teacher.insertMany([
            {
                name: 'Dr. Rajesh Kumar',
                email: 'rajesh.kumar@campusflow.in',
                department: 'CSE',
                employeeId: 'T001',
                password: teacherPassword,
                assignedClasses: []
            },
            {
                name: 'Prof. Priya Sharma',
                email: 'priya.sharma@campusflow.in',
                department: 'CSE',
                employeeId: 'T002',
                password: teacherPassword,
                assignedClasses: []
            },
            {
                name: 'Dr. Amit Patel',
                email: 'amit.patel@campusflow.in',
                department: 'ECE',
                employeeId: 'T003',
                password: teacherPassword,
                assignedClasses: []
            },
            {
                name: 'Prof. Sneha Reddy',
                email: 'sneha.reddy@campusflow.in',
                department: 'Mathematics',
                employeeId: 'T004',
                password: teacherPassword,
                assignedClasses: []
            }
        ]);
        console.log('Created', teachers.length, 'teachers');

        // Create Classes
        const classes = await Class.insertMany([
            {
                name: 'CSE_A_2024',
                department: 'CSE',
                students: [],
                year: 2024
            },
            {
                name: 'CSE_B_2024',
                department: 'CSE',
                students: [],
                year: 2024
            },
            {
                name: 'ECE_A_2024',
                department: 'ECE',
                students: [],
                year: 2024
            }
        ]);
        console.log('Created', classes.length, 'classes');

        // Update teachers with assigned classes
        await Teacher.findByIdAndUpdate(teachers[0]._id, { assignedClasses: [classes[0]._id, classes[1]._id] });
        await Teacher.findByIdAndUpdate(teachers[1]._id, { assignedClasses: [classes[0]._id] });
        await Teacher.findByIdAndUpdate(teachers[2]._id, { assignedClasses: [classes[2]._id] });

        // Create Students
        const studentPassword = await bcrypt.hash('student123', 10);
        const students = [];

        // CSE Class A students
        const cseAStudents = [
            { name: 'Aryan Singh', rollNumber: 'CSE001', email: 'aryan.singh@campusflow.in' },
            { name: 'Ananya Gupta', rollNumber: 'CSE002', email: 'ananya.gupta@campusflow.in' },
            { name: 'Arjun Mehta', rollNumber: 'CSE003', email: 'arjun.mehta@campusflow.in' },
            { name: 'Avni Joshi', rollNumber: 'CSE004', email: 'avni.joshi@campusflow.in' },
            { name: 'Aditya Sharma', rollNumber: 'CSE005', email: 'aditya.sharma@campusflow.in' },
            { name: 'Anika Patel', rollNumber: 'CSE006', email: 'anika.patel@campusflow.in' },
            { name: 'Rohan Verma', rollNumber: 'CSE007', email: 'rohan.verma@campusflow.in' },
            { name: 'Riya Kapoor', rollNumber: 'CSE008', email: 'riya.kapoor@campusflow.in' }
        ];

        // CSE Class B students
        const cseBStudents = [
            { name: 'Karan Desai', rollNumber: 'CSE009', email: 'karan.desai@campusflow.in' },
            { name: 'Kriti Mishra', rollNumber: 'CSE010', email: 'kriti.mishra@campusflow.in' },
            { name: 'Kartik Nair', rollNumber: 'CSE011', email: 'kartik.nair@campusflow.in' },
            { name: 'Khushi Singh', rollNumber: 'CSE012', email: 'khushi.singh@campusflow.in' },
            { name: 'Lakshay Gupta', rollNumber: 'CSE013', email: 'lakshay.gupta@campusflow.in' },
            { name: 'Lavanya Reddy', rollNumber: 'CSE014', email: 'lavanya.reddy@campusflow.in' }
        ];

        // ECE Class A students
        const eceAStudents = [
            { name: 'Mohit Kumar', rollNumber: 'ECE001', email: 'mohit.kumar@campusflow.in' },
            { name: 'Manya Agarwal', rollNumber: 'ECE002', email: 'manya.agarwal@campusflow.in' },
            { name: 'Nikhil Sharma', rollNumber: 'ECE003', email: 'nikhil.sharma@campusflow.in' },
            { name: 'Neha Gupta', rollNumber: 'ECE004', email: 'neha.gupta@campusflow.in' }
        ];

        // Create all students
        for (const s of cseAStudents) {
            students.push({
                name: s.name,
                rollNumber: s.rollNumber,
                email: s.email,
                password: studentPassword,
                department: 'CSE',
                class: classes[0]._id,
                year: 2024
            });
        }
        for (const s of cseBStudents) {
            students.push({
                name: s.name,
                rollNumber: s.rollNumber,
                email: s.email,
                password: studentPassword,
                department: 'CSE',
                class: classes[1]._id,
                year: 2024
            });
        }
        for (const s of eceAStudents) {
            students.push({
                name: s.name,
                rollNumber: s.rollNumber,
                email: s.email,
                password: studentPassword,
                department: 'ECE',
                class: classes[2]._id,
                year: 2024
            });
        }

        const createdStudents = await Student.insertMany(students);
        console.log('Created', createdStudents.length, 'students');

        // Update classes with students
        await Class.findByIdAndUpdate(classes[0]._id, { students: createdStudents.slice(0, 8).map(s => s._id) });
        await Class.findByIdAndUpdate(classes[1]._id, { students: createdStudents.slice(8, 14).map(s => s._id) });
        await Class.findByIdAndUpdate(classes[2]._id, { students: createdStudents.slice(14).map(s => s._id) });

        // Create Subjects
        const subjects = await Subject.insertMany([
            { name: 'Data Structures', code: 'CS201', department: 'CSE', credits: 4 },
            { name: 'Algorithms', code: 'CS202', department: 'CSE', credits: 4 },
            { name: 'Database Management', code: 'CS301', department: 'CSE', credits: 3 },
            { name: 'Web Development', code: 'CS302', department: 'CSE', credits: 3 },
            { name: 'Digital Electronics', code: 'EC201', department: 'ECE', credits: 4 },
            { name: 'Signal Processing', code: 'EC202', department: 'ECE', credits: 4 },
            { name: 'Engineering Mathematics', code: 'MA201', department: 'Mathematics', credits: 4 }
        ]);
        console.log('Created', subjects.length, 'subjects');

        // Create Tasks
        const tasks = await Task.insertMany([
            {
                title: 'Binary Search Tree Implementation',
                description: 'Implement a Binary Search Tree with insert, delete, and search operations.',
                class: classes[0]._id,
                teacherId: teachers[0]._id,
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                type: 'document',
                fileUrl: 'https://example.com/uploads/bst-assignment.pdf',
                submissions: []
            },
            {
                title: 'SQL Query Practice',
                description: 'Solve the given SQL queries and submit the answers.',
                class: classes[0]._id,
                teacherId: teachers[1]._id,
                deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                type: 'form',
                formLink: 'https://forms.google.com/example-form',
                submissions: []
            },
            {
                title: 'Hackathon 2024',
                description: 'Annual coding hackathon. Register and participate.',
                class: classes[0]._id,
                teacherId: teachers[0]._id,
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                type: 'hackathon',
                hackathonDetails: {
                    platform: 'Devpost',
                    startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                    endDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000),
                    registrationLink: 'https://devpost.com/hackathon2024',
                    requirements: 'Team of 2-4 members, laptop, internet connection'
                },
                submissions: []
            },
            {
                title: 'Algorithms Quiz',
                description: 'Online quiz on sorting and searching algorithms.',
                class: classes[1]._id,
                teacherId: teachers[0]._id,
                deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
                type: 'quiz',
                quizDetails: {
                    totalQuestions: 20,
                    timeLimit: 30,
                    passingScore: 12,
                    quizLink: 'https://quiz.example.com/algo-quiz'
                },
                submissions: []
            },
            {
                title: 'Web Development Project',
                description: 'Build a responsive portfolio website using HTML, CSS, and JavaScript.',
                class: classes[0]._id,
                teacherId: teachers[1]._id,
                deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
                type: 'project',
                projectDetails: {
                    requirements: 'Responsive design, Contact form, About section',
                    deliverables: ['Source code', 'Documentation', 'Live demo link'],
                    evaluationCriteria: ['Design', 'Code Quality', 'Functionality', 'Documentation']
                },
                submissions: []
            },
            {
                title: 'Circuit Design Assignment',
                description: 'Design and simulate a digital counter circuit.',
                class: classes[2]._id,
                teacherId: teachers[2]._id,
                deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
                type: 'document',
                fileUrl: 'https://example.com/uploads/circuit-assignment.pdf',
                submissions: []
            }
        ]);
        console.log('Created', tasks.length, 'tasks');

        // Create Events
        const events = await Event.insertMany([
            {
                title: 'Annual Tech Fest 2024',
                description: 'Join us for the biggest tech event of the year featuring competitions, workshops, and guest lectures from industry experts.',
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                formLink: 'https://forms.google.com/tech-fest-2024'
            },
            {
                title: 'Placement Drive - Tech Corp',
                description: 'On-campus placement opportunity for final year students. Register to attend the pre-placement talk.',
                deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
                formLink: 'https://forms.google.com/placement-tech-corp'
            },
            {
                title: 'Workshop: AI & Machine Learning',
                description: 'Hands-on workshop on basics of AI and ML using Python. Limited seats available.',
                deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                formLink: 'https://forms.google.com/ai-ml-workshop'
            },
            {
                title: 'Sports Week 2024',
                description: 'Annual sports week with cricket, football, basketball, and athletics competitions.',
                deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                formLink: 'https://forms.google.com/sports-week-2024'
            },
            {
                title: 'Guest Lecture: Cloud Computing',
                description: 'Industry expert sharing insights on cloud technologies and career opportunities.',
                deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                formLink: 'https://forms.google.com/cloud-lecture'
            }
        ]);
        console.log('Created', events.length, 'events');

        console.log('\n========================================');
        console.log('SEED DATA COMPLETED SUCCESSFULLY!');
        console.log('========================================\n');
        console.log('LOGIN CREDENTIALS:\n');
        console.log('ADMIN:');
        console.log('  Email: admin@campusflow.in');
        console.log('  Password: admin123\n');
        console.log('TEACHERS:');
        console.log('  Email: rajesh.kumar@campusflow.in');
        console.log('  Password: teacher123\n');
        console.log('  Email: priya.sharma@campusflow.in');
        console.log('  Password: teacher123\n');
        console.log('STUDENTS:');
        console.log('  Email: aryan.singh@campusflow.in');
        console.log('  Password: student123\n');
        console.log('========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();
