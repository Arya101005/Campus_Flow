const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Admin = require('../models/admin.model');
const Student = require('../models/student.model'); // Import Student model
const Teacher = require('../models/teacher.model'); // Import Teacher model
const Subject = require('../models/subject.model'); // Import Subject model
const Timetable = require('../models/timetable.model'); // Import Timetable model
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs'); // Required to delete the temporary file
const Class = require('../models/class.model'); // Import Class model
const User = require('../models/user.model'); // Import User model explicitly

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' }); // temporary directory for uploaded files

// Helper function to generate email and a default password
const generateCredentials = (name, role = 'student') => {
    const nameParts = name.toLowerCase().split(' ').filter(part => part.length > 0);
    const baseEmail = nameParts.join('.');
    const email = `${baseEmail}@campusflow.in`;
    // You might want different default passwords or a more complex generation
    const defaultPassword = 'Welcome123!'; 
    return { email, defaultPassword };
};

// Admin Signup Route
router.post('/signup', async (req, res) => {
    try {
        console.log('Received signup request:', req.body);
        const { name, email, department, password } = req.body;

        // Validate required fields
        if (!name || !email || !department || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new admin
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

// Admin Login Route
router.post('/login', async (req, res) => {
    try {
        console.log('Received login request:', req.body);
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Check if admin exists
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
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

// Excel Upload Route
router.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
    let filePath = null; // Initialize filePath
    try {
        console.log('Received Excel upload request');

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        filePath = req.file.path; // Assign filePath

        const workbook = xlsx.readFile(filePath);

        const studentSheet = workbook.Sheets['Students'];
        const teacherSheet = workbook.Sheets['Teachers'];
        const subjectSheet = workbook.Sheets['Subjects'];
        const timetableSheet = workbook.Sheets['Timetable'];

        const missingSheets = [];
        if (!studentSheet) missingSheets.push('Students');
        if (!teacherSheet) missingSheets.push('Teachers');
        if (!subjectSheet) missingSheets.push('Subjects');
        if (!timetableSheet) missingSheets.push('Timetable');

        if (missingSheets.length > 0) {
            return res.status(400).json({ message: `Missing required sheet(s): ${missingSheets.join(', ')}` });
        }

        const studentsData = xlsx.utils.sheet_to_json(studentSheet);
        const teachersData = xlsx.utils.sheet_to_json(teacherSheet);
        const subjectsData = xlsx.utils.sheet_to_json(subjectSheet);
        const timetableData = xlsx.utils.sheet_to_json(timetableSheet);

        console.log('Parsed Students Data:', studentsData);
        console.log('Parsed Teachers Data:', teachersData);
        console.log('Parsed Subjects Data:', subjectsData);
        console.log('Parsed Timetable Data:', timetableData);

        const uploadSummary = {
            students: { total: 0, inserted: 0, skipped: 0, errors: [], credentials: [] },
            teachers: { total: 0, inserted: 0, skipped: 0, errors: [], credentials: [] },
            subjects: { total: 0, inserted: 0, skipped: 0, errors: [] },
            timetable: { total: 0, inserted: 0, skipped: 0, errors: [] }
        };

        // Process Students Data
        uploadSummary.students.total = studentsData.length;
        const studentsToInsert = [];

        for (const student of studentsData) {
            try {
                if (!student['Full Name'] || !student['Roll Number'] || !student['Department'] || !student['Class'] || !student['Year']) {
                    uploadSummary.students.skipped++;
                    uploadSummary.students.errors.push(`Skipped student due to missing required fields (Name, Roll Number, Department, Class, Year): ${JSON.stringify(student)}`);
                    continue;
                }

                const { email, defaultPassword } = generateCredentials(student['Full Name'], 'student');
                const hashedPassword = await bcrypt.hash(defaultPassword, 10);

                // Check for existing student by email or roll number
                const existingStudent = await Student.findOne({ $or: [{ email: email }, { rollNumber: student['Roll Number'] }] });
                if (existingStudent) {
                    uploadSummary.students.skipped++;
                    uploadSummary.students.errors.push(`Skipped student (email or roll number already exists): ${student['Full Name']} - ${student['Roll Number']}`);
                    continue;
                }

                // Find or create the Class document based on Department and Class name
                const className = student['Class'];
                const departmentName = student['Department'];
                let classDoc = await Class.findOne({ name: className, department: departmentName });

                if (!classDoc) {
                    // Create the class if it doesn't exist
                    classDoc = new Class({ name: className, department: departmentName, students: [] });
                    await classDoc.save();
                    console.log(`Created new class: ${className} in ${departmentName}`);
                }

                studentsToInsert.push({
                    name: student['Full Name'],
                    email: email,
                    password: hashedPassword,
                    rollNumber: student['Roll Number'],
                    department: departmentName,
                    class: classDoc._id, // Store ObjectId reference to the Class document
                    year: student['Year']
                });

                // Store credentials for the report
                uploadSummary.students.credentials.push({
                    name: student['Full Name'],
                    email: email,
                    password: defaultPassword
                });

            } catch (error) {
                uploadSummary.students.skipped++;
                uploadSummary.students.errors.push(`Error processing student ${student['Full Name']}: ${error.message}`);
                console.error(`Error processing student ${student['Full Name']}:`, error);
            }
        }

        if (studentsToInsert.length > 0) {
            try {
                // Insert students in bulk
                const insertResult = await Student.insertMany(studentsToInsert, { ordered: false });
                uploadSummary.students.inserted = insertResult.length;
                console.log(`Successfully inserted ${insertResult.length} students.`);

                // Now, update the Class documents to include the new students
                const classUpdates = [];
                for (const insertedStudent of insertResult) {
                    classUpdates.push(
                        Class.updateOne(
                            { _id: insertedStudent.class }, // Find the class by its ID
                            { $addToSet: { students: insertedStudent._id } } // Add student ID if not already present
                        )
                    );
                }
                await Promise.all(classUpdates);
                 console.log(`Successfully updated ${classUpdates.length} classes with new students.`);

            } catch (insertError) {
                console.error('Error inserting students or updating classes:', insertError);
                 // Check for individual write errors from insertMany
                 if (insertError.writeErrors) {
                    insertError.writeErrors.forEach(err => {
                        // Log or add specific write errors to summary if needed
                        console.error('Student write error:', err.errmsg, JSON.stringify(err.toJSON().op));
                         // Attempt to extract identifier from the failed operation
                        const failedOp = err.toJSON().op;
                        const identifier = failedOp ? (failedOp.email || failedOp.rollNumber || 'Unknown Student') : 'Unknown Student';
                         uploadSummary.students.errors.push(`Student insertion error for ${identifier}: ${err.errmsg}`);
                    });
                    // Estimate inserted count based on successful writes if available
                     if (insertError.result && insertError.result.nInserted !== undefined) {
                         uploadSummary.students.inserted = insertError.result.nInserted;
                     } else {
                          // Fallback if nInserted is not available (less reliable)
                          uploadSummary.students.inserted = studentsToInsert.length - insertError.writeErrors.length;
                     }

                      // Recalculate skipped based on total processed, inserted, and explicit errors
                     const processedCount = studentsData.length - uploadSummary.students.errors.filter(e => e.startsWith('Skipped student')).length;
                      uploadSummary.students.skipped = processedCount - uploadSummary.students.inserted;


                     // Filter credentials to only include those that were successfully inserted
                     const errorIdentifiers = insertError.writeErrors.map(err => err.toJSON().op.email || err.toJSON().op.rollNumber);
                     uploadSummary.students.credentials = uploadSummary.students.credentials.filter(cred => !errorIdentifiers.includes(cred.email) && !errorIdentifiers.includes(cred.rollNumber));
                 } else {
                     uploadSummary.students.errors.push(`Bulk student insertion or class update failed: ${insertError.message}`);
                      uploadSummary.students.inserted = 0;
                      uploadSummary.students.skipped = uploadSummary.students.total - uploadSummary.students.errors.length; // All remaining are skipped/errored
                 }
            }
        }

        // Process Teachers Data
        uploadSummary.teachers.total = teachersData.length;
        const teachersToInsert = [];

        for (const teacher of teachersData) {
            try {
                if (!teacher['Full Name'] || !teacher['Department']) {
                     uploadSummary.teachers.skipped++;
                     uploadSummary.teachers.errors.push(`Skipped teacher due to missing required fields: ${JSON.stringify(teacher)}`);
                     continue;
                }

                const { email, defaultPassword } = generateCredentials(teacher['Full Name'], 'teacher');
                const hashedPassword = await bcrypt.hash(defaultPassword, 10);

                const existingTeacher = await Teacher.findOne({ $or: [{ email: email }, { employeeId: teacher['Employee ID'] }] }); // Assuming 'Employee ID' column
                if (existingTeacher) {
                     uploadSummary.teachers.skipped++;
                     uploadSummary.teachers.errors.push(`Skipped teacher (email or employee ID already exists): ${teacher['Full Name']} - ${teacher['Employee ID'] || 'N/A'}`);
                     continue;
                }

                teachersToInsert.push({
                    name: teacher['Full Name'],
                    email: email,
                    password: hashedPassword,
                    department: teacher['Department'],
                    employeeId: teacher['Employee ID'] // Assuming 'Employee ID' column
                });

                // Store credentials for the report
                 uploadSummary.teachers.credentials.push({
                    name: teacher['Full Name'],
                    email: email,
                    password: defaultPassword
                 });

            } catch (error) {
                 uploadSummary.teachers.skipped++;
                 uploadSummary.teachers.errors.push(`Error processing teacher ${teacher['Full Name']}: ${error.message}`);
                 console.error(`Error processing teacher ${teacher['Full Name']}:`, error);
            }
        }

        if (teachersToInsert.length > 0) {
            try {
                const insertResult = await Teacher.insertMany(teachersToInsert, { ordered: false });
                uploadSummary.teachers.inserted = insertResult.length;
                 console.log(`Successfully inserted ${insertResult.length} teachers.`);
            } catch (insertError) {
                 console.error('Error inserting teachers:', insertError);
                 if (insertError.writeErrors) {
                    insertError.writeErrors.forEach(err => {
                         const identifier = err.toJSON().op ? (err.toJSON().op.email || err.toJSON().op.employeeId) : 'Unknown';
                         uploadSummary.teachers.errors.push(`Teacher insertion error for ${identifier}: ${err.errmsg}`);
                    });
                     const successfulInserts = teachersToInsert.length - insertError.writeErrors.length;
                     uploadSummary.teachers.inserted = successfulInserts;
                      uploadSummary.teachers.skipped = uploadSummary.teachers.total - successfulInserts - (uploadSummary.teachers.total - teachersToInsert.length);

                     const errorIdentifiers = insertError.writeErrors.map(err => err.toJSON().op.email || err.toJSON().op.employeeId);
                      uploadSummary.teachers.credentials = uploadSummary.teachers.credentials.filter(cred => !errorIdentifiers.includes(cred.email) && !errorIdentifiers.includes(cred.employeeId));
                 } else {
                     uploadSummary.teachers.errors.push(`Bulk teacher insertion failed: ${insertError.message}`);
                      uploadSummary.teachers.inserted = 0;
                      uploadSummary.teachers.skipped = uploadSummary.teachers.total;
                 }
            }
        }

        // Process Subjects Data
        uploadSummary.subjects.total = subjectsData.length;
        const subjectsToInsert = [];

        for (const subject of subjectsData) {
            try {
                if (!subject['Subject Name'] || !subject['Subject Code']) { // Assuming 'Subject Name' and 'Subject Code' columns
                    uploadSummary.subjects.skipped++;
                    uploadSummary.subjects.errors.push(`Skipped subject due to missing required fields: ${JSON.stringify(subject)}`);
                    continue;
                }

                const existingSubject = await Subject.findOne({ $or: [{ name: subject['Subject Name'] }, { code: subject['Subject Code'] }] });
                if (existingSubject) {
                     uploadSummary.subjects.skipped++;
                     uploadSummary.subjects.errors.push(`Skipped subject (name or code already exists): ${subject['Subject Name']} - ${subject['Subject Code']}`);
                     continue;
                }

                subjectsToInsert.push({
                    name: subject['Subject Name'],
                    code: subject['Subject Code'],
                    department: subject['Department'], // Assuming 'Department' column
                    credits: subject['Credits'] // Assuming 'Credits' column
                });

            } catch (error) {
                 uploadSummary.subjects.skipped++;
                 uploadSummary.subjects.errors.push(`Error processing subject ${subject['Subject Name']}: ${error.message}`);
                 console.error(`Error processing subject ${subject['Subject Name']}:`, error);
            }
        }

        if (subjectsToInsert.length > 0) {
            try {
                const insertResult = await Subject.insertMany(subjectsToInsert, { ordered: false });
                uploadSummary.subjects.inserted = insertResult.length;
                 console.log(`Successfully inserted ${insertResult.length} subjects.`);
            } catch (insertError) {
                 console.error('Error inserting subjects:', insertError);
                 if (insertError.writeErrors) {
                    insertError.writeErrors.forEach(err => {
                         const identifier = err.toJSON().op ? (err.toJSON().op.name || err.toJSON().op.code) : 'Unknown';
                         uploadSummary.subjects.errors.push(`Subject insertion error for ${identifier}: ${err.errmsg}`);
                    });
                     const successfulInserts = subjectsToInsert.length - insertError.writeErrors.length;
                     uploadSummary.subjects.inserted = successfulInserts;
                      uploadSummary.subjects.skipped = uploadSummary.subjects.total - successfulInserts - (uploadSummary.subjects.total - subjectsToInsert.length);
                 } else {
                     uploadSummary.subjects.errors.push(`Bulk subject insertion failed: ${insertError.message}`);
                      uploadSummary.subjects.inserted = 0;
                      uploadSummary.subjects.skipped = uploadSummary.subjects.total;
                 }
            }
        }

        // Process Timetable Data
        uploadSummary.timetable.total = timetableData.length;
        const timetableToInsert = [];

        for (const entry of timetableData) {
            try {
                // Assuming columns: 'Day', 'Start Time', 'End Time', 'Subject Code', 'Teacher Email', 'Class', 'Department'
                if (!entry['Day'] || !entry['Start Time'] || !entry['End Time'] || !entry['Subject Code'] || !entry['Teacher Email'] || !entry['Class'] || !entry['Department']) {
                    uploadSummary.timetable.skipped++;
                    uploadSummary.timetable.errors.push(`Skipped timetable entry due to missing required fields: ${JSON.stringify(entry)}`);
                    continue;
                }

                // Find Subject and Teacher by their unique identifiers
                const subject = await Subject.findOne({ code: entry['Subject Code'] });
                const teacher = await Teacher.findOne({ email: entry['Teacher Email'] });

                if (!subject) {
                    uploadSummary.timetable.skipped++;
                    uploadSummary.timetable.errors.push(`Skipped timetable entry for Subject Code ${entry['Subject Code']}: Subject not found.`);
                    continue;
                }

                if (!teacher) {
                    uploadSummary.timetable.skipped++;
                    uploadSummary.timetable.errors.push(`Skipped timetable entry for Teacher Email ${entry['Teacher Email']}: Teacher not found.`);
                    continue;
                }

                // Check for existing timetable entry to avoid duplicates (optional, depends on uniqueness constraints)
                // For now, we allow duplicates based on the provided data. Add a check here if needed.

                timetableToInsert.push({
                    day: entry['Day'],
                    startTime: entry['Start Time'],
                    endTime: entry['End Time'],
                    subject: subject._id, // Use ObjectId reference
                    teacher: teacher._id, // Use ObjectId reference
                    class: entry['Class'],
                    department: entry['Department']
                });

            } catch (error) {
                uploadSummary.timetable.skipped++;
                uploadSummary.timetable.errors.push(`Error processing timetable entry ${JSON.stringify(entry)}: ${error.message}`);
                console.error(`Error processing timetable entry ${JSON.stringify(entry)}:`, error);
            }
        }

        if (timetableToInsert.length > 0) {
            try {
                const insertResult = await Timetable.insertMany(timetableToInsert, { ordered: false });
                uploadSummary.timetable.inserted = insertResult.length;
                 console.log(`Successfully inserted ${insertResult.length} timetable entries.`);
            } catch (insertError) {
                 console.error('Error inserting timetable entries:', insertError);
                 if (insertError.writeErrors) {
                    insertError.writeErrors.forEach(err => {
                         uploadSummary.timetable.errors.push(`Timetable insertion error: ${err.errmsg} for entry ${JSON.stringify(err.toJSON().op)}`);
                    });
                     uploadSummary.timetable.inserted = timetableToInsert.length - insertError.writeErrors.length;
                      uploadSummary.timetable.skipped = uploadSummary.timetable.total - uploadSummary.timetable.inserted;
                 } else {
                     uploadSummary.timetable.errors.push(`Bulk timetable insertion failed: ${insertError.message}`);
                      uploadSummary.timetable.inserted = 0;
                      uploadSummary.timetable.skipped = uploadSummary.timetable.total;
                 }
            }
        }

        res.status(200).json({ message: 'Excel file processed', summary: uploadSummary });

    } catch (error) {
        console.error('Excel upload route error:', error);
        // Attempt to clean up the file if it exists and wasn't already deleted
        if (filePath) {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting temporary file:', err);
            });
        }
        res.status(500).json({ message: 'Error processing Excel file: ' + error.message });
    } finally {
        // Ensure the file is deleted even if there's an error before the catch block
        if (filePath) {
             fs.unlink(filePath, (err) => {
                 if (err) console.error('Error in finally deleting temporary file:', err);
             });
        }
    }
});

router.get('/classes/:classId', async (req, res) => {
    try {
        // The verifyToken middleware is applied in server.js
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const classDetails = await Class.findById(req.params.classId)
            .populate({
                path: 'students',
                select: 'name rollNumber email year department class',
                 populate: {
                     path: 'class',
                    select: 'name' // Populate the 'class' field within the student document with the class name
                 }
            })
            .lean();

        res.status(200).json(classDetails);
    } catch (error) {
        console.error('Error fetching class details:', error);
        res.status(500).json({ message: 'Error fetching class details: ' + error.message });
    }
});

// Get all unique department names (simplified for initial load)
router.get('/departments', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get all unique departments names only
        const departmentNames = await Student.distinct('department');
        
        console.log('Fetched department names:', departmentNames);
        res.status(200).json(departmentNames);

    } catch (error) {
        console.error('Error fetching department names:', error);
        res.status(500).json({ 
            message: 'Error fetching department names', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get detailed information about a specific department
router.get('/departments/:departmentName', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const departmentName = req.params.departmentName;

        // Get all classes in this department
        const classes = await Class.find({ department: departmentName })
            .select('name students')
            .lean();

        // Get all teachers in this department
        const teachers = await Teacher.find({ department: departmentName })
            .select('name email')
            .lean();

        res.status(200).json({
            name: departmentName,
            classes: classes,
            teachers: teachers
        });

    } catch (error) {
        console.error('Error fetching department details:', error);
        res.status(500).json({ 
            message: 'Error fetching department details', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get counts for a specific department
router.get('/departments/counts', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const departmentName = req.query.departmentName; // Get department name from query parameters

        if (!departmentName) {
            return res.status(400).json({ message: 'Department name is required' });
        }

        // Fetch counts
        const totalClasses = await Class.countDocuments({ department: departmentName });
        const totalStudents = await Student.countDocuments({ department: departmentName });
        const totalTeachers = await Teacher.countDocuments({ department: departmentName });

        res.status(200).json({
            totalClasses: totalClasses,
            totalStudents: totalStudents,
            totalTeachers: totalTeachers,
        });

    } catch (error) {
        console.error(`Error fetching counts for department ${req.query.departmentName}:`, error);
        res.status(500).json({ 
            message: 'Error fetching department counts', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Endpoint to distribute students into Class 1 and Class 2 per department
router.post('/distribute-classes', async (req, res) => {
    try {
        // The verifyToken middleware is applied in server.js
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get all unique departments
        const departments = await Student.distinct('department');
        const summary = {
            updatedDepartments: 0,
            createdClasses: 0,
            updatedStudents: 0,
            errors: []
        };

        for (const deptName of departments) {
            try {
                // Get all students in this department
                const studentsInDept = await Student.find({ department: deptName });
                const totalStudents = studentsInDept.length;

                if (totalStudents === 0) {
                    summary.errors.push(`No students found in department ${deptName}`);
                    continue;
                }

                // Create or find Class 1 and Class 2 for this department
                const class1Name = `${deptName} Class 1`;
                const class2Name = `${deptName} Class 2`;

                let class1 = await Class.findOne({ name: class1Name, department: deptName });
                if (!class1) {
                    class1 = new Class({ name: class1Name, department: deptName, students: [] });
                    await class1.save();
                    summary.createdClasses++;
                }

                let class2 = await Class.findOne({ name: class2Name, department: deptName });
                if (!class2) {
                    class2 = new Class({ name: class2Name, department: deptName, students: [] });
                    await class2.save();
                    summary.createdClasses++;
                }

                // Clear existing students from these classes
                await Class.updateOne({ _id: class1._id }, { $set: { students: [] } });
                await Class.updateOne({ _id: class2._id }, { $set: { students: [] } });

                // Distribute students (simple split)
                const midPoint = Math.ceil(totalStudents / 2);
                const studentsClass1 = studentsInDept.slice(0, midPoint);
                const studentsClass2 = studentsInDept.slice(midPoint);

                // Update students and classes
                const studentUpdates = [];

                // Update Class 1 students
                for (const student of studentsClass1) {
                    studentUpdates.push(
                        Student.updateOne(
                            { _id: student._id },
                            { $set: { class: class1._id } }
                        )
                    );
                    class1.students.push(student._id);
                }

                // Update Class 2 students
                for (const student of studentsClass2) {
                    studentUpdates.push(
                        Student.updateOne(
                            { _id: student._id },
                            { $set: { class: class2._id } }
                        )
                    );
                    class2.students.push(student._id);
                }

                // Execute all student updates
                await Promise.all(studentUpdates);
                summary.updatedStudents += studentUpdates.length;

                // Save updated classes
                await class1.save();
                await class2.save();

                summary.updatedDepartments++;

            } catch (deptError) {
                console.error(`Error processing department ${deptName}:`, deptError);
                summary.errors.push(`Error processing department ${deptName}: ${deptError.message}`);
            }
        }

        res.status(200).json({
            message: 'Class distribution complete',
            summary: summary
        });

    } catch (error) {
        console.error('Error during class distribution:', error);
        res.status(500).json({
            message: 'Error during class distribution',
            error: error.message
        });
    }
});

// Get all Classes (Admin only)
router.get('/classes', async (req, res) => {
    try {
        // Assuming verifyToken middleware is applied before this route
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Only admins can view classes.' });
        }

        const classes = await Class.find().populate('students', 'name rollNumber');

        res.json(classes);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ message: 'Error fetching classes', error: error.message });
    }
});

// Get all teachers (Admin only)
router.get('/teachers', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Only admins can view teachers.' });
        }

        const teachers = await Teacher.find().select('name email department');
        res.json(teachers);
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ message: 'Error fetching teachers', error: error.message });
    }
});

// Assign teacher to class
router.post('/classes/:classId/assign-teacher', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Only admins can assign teachers.' });
        }

        const { classId } = req.params;
        const { teacherId } = req.body;

        if (!teacherId) {
            return res.status(400).json({ message: 'Teacher ID is required' });
        }

        // Update the class with the assigned teacher
        const updatedClass = await Class.findByIdAndUpdate(
            classId,
            { teacher: teacherId },
            { new: true }
        ).populate('teacher', 'name email department');

        if (!updatedClass) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Update the teacher's assignedClasses array
        await Teacher.findByIdAndUpdate(
            teacherId,
            { $addToSet: { assignedClasses: classId } }
        );

        res.json(updatedClass);
    } catch (error) {
        console.error('Error assigning teacher:', error);
        res.status(500).json({ message: 'Error assigning teacher', error: error.message });
    }
});

module.exports = router; 