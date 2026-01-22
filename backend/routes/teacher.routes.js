const express = require('express');
const router = express.Router();
const Teacher = require('../models/teacher.model');
const Class = require('../models/class.model');
const { verifyToken } = require('../middleware/auth');

// Get teacher's assigned classes
router.get('/classes', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can access this endpoint' });
        }

        console.log('Fetching assigned classes for teacher user ID:', req.user.id);

        const teacher = await Teacher.findById(req.user.id);

        console.log('Teacher document found before population:', teacher);

        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        // Now fetch with population
        const populatedTeacher = await Teacher.findById(req.user.id)
            .populate({
                path: 'assignedClasses',
                populate: {
                    path: 'students',
                    select: 'name rollNumber'
                }
            });

        res.json(populatedTeacher.assignedClasses);
    } catch (error) {
        console.error('Error fetching teacher classes:', error);
        res.status(500).json({ 
            message: 'Error fetching teacher classes', 
            error: error.message 
        });
    }
});

// Assign class to teacher
router.post('/assign-class', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can assign classes' });
        }

        const { teacherId, classId } = req.body;

        const teacher = await Teacher.findById(teacherId);
        const classToAssign = await Class.findById(classId);

        if (!teacher || !classToAssign) {
            return res.status(404).json({ message: 'Teacher or class not found' });
        }

        // Check if class is already assigned
        if (teacher.assignedClasses.includes(classId)) {
            return res.status(400).json({ message: 'Class already assigned to teacher' });
        }

        teacher.assignedClasses.push(classId);
        await teacher.save();

        res.json({ message: 'Class assigned successfully', teacher });
    } catch (error) {
        console.error('Error assigning class:', error);
        res.status(500).json({ 
            message: 'Error assigning class', 
            error: error.message 
        });
    }
});

module.exports = router; 