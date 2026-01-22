const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Task = require('../models/task.model');
const { verifyToken } = require('../middleware/auth');
const Student = require('../models/student.model');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /pdf|doc|docx|zip|rar/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Only PDF, Word documents, and archives are allowed!');
        }
    }
});

// Create new task (Teacher only)
router.post('/create', verifyToken, upload.single('file'), async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            if (req.file) {
                console.log(`Attempting to delete file for denied access: ${req.file.path}`);
                try {
                    const fs = require('fs');
                    fs.unlinkSync(req.file.path);
                     console.log(`Successfully deleted file: ${req.file.path}`);
                } catch (deleteError) {
                    console.error(`Failed to delete file ${req.file.path}:`, deleteError);
                }
            }
            return res.status(403).json({ message: 'Only teachers can create tasks' });
        }

        const { title, description, class: className, deadline, type } = req.body;

        if (!title || !description || !className || !deadline || !type) {
            if (req.file) {
                 console.log(`Attempting to delete file for missing fields: ${req.file.path}`);
                 try {
                    const fs = require('fs');
                    fs.unlinkSync(req.file.path);
                     console.log(`Successfully deleted file: ${req.file.path}`);
                } catch (deleteError) {
                    console.error(`Failed to delete file ${req.file.path}:`, deleteError);
                }
            }
            return res.status(400).json({ message: 'All fields are required' });
        }

        const taskData = {
            title,
            description,
            class: className,
            teacherId: req.user.id,
            deadline: new Date(deadline),
            type,
            submissions: []
        };

        switch (type) {
            case 'document':
                if (req.file) {
                    taskData.fileUrl = req.file.path;
                }
                break;
            case 'form':
                taskData.formLink = req.body.formLink;
                if (req.file) {
                    console.log(`Attempting to delete unexpected file for non-document task (${type}): ${req.file.path}`);
                    try {
                        const fs = require('fs');
                        fs.unlinkSync(req.file.path);
                         console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                    } catch (deleteError) {
                        console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                    }
                }
                break;
            case 'hackathon':
                taskData.hackathonDetails = {
                    startDate: new Date(req.body.startDate),
                    endDate: new Date(req.body.endDate),
                    platform: req.body.platform,
                    registrationLink: req.body.registrationLink,
                    requirements: req.body.requirements
                };
                if (req.file) {
                    console.log(`Attempting to delete unexpected file for non-document task (${type}): ${req.file.path}`);
                    try {
                        const fs = require('fs');
                        fs.unlinkSync(req.file.path);
                         console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                    } catch (deleteError) {
                        console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                    }
                }
                break;
            case 'quiz':
                taskData.quizDetails = {
                    totalQuestions: parseInt(req.body.totalQuestions),
                    timeLimit: parseInt(req.body.timeLimit),
                    passingScore: parseInt(req.body.passingScore),
                    quizLink: req.body.quizLink
                };
                if (req.file) {
                    console.log(`Attempting to delete unexpected file for non-document task (${type}): ${req.file.path}`);
                    try {
                        const fs = require('fs');
                        fs.unlinkSync(req.file.path);
                         console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                    } catch (deleteError) {
                        console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                    }
                }
                break;
            case 'project':
                taskData.projectDetails = {
                    requirements: req.body.requirements,
                    deliverables: req.body.deliverables ? req.body.deliverables.split(',') : [],
                    evaluationCriteria: req.body.evaluationCriteria ? req.body.evaluationCriteria.split(',') : []
                };
                if (req.file) {
                    console.log(`Attempting to delete unexpected file for non-document task (${type}): ${req.file.path}`);
                    try {
                        const fs = require('fs');
                        fs.unlinkSync(req.file.path);
                         console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                    } catch (deleteError) {
                        console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                    }
                }
                break;
            default:
                if (req.file) {
                     console.log(`Attempting to delete unexpected file for unknown task type (${type}): ${req.file.path}`);
                     try {
                        const fs = require('fs');
                        fs.unlinkSync(req.file.path);
                         console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                     } catch (deleteError) {
                         console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                     }
                 }
                 return res.status(400).json({ message: 'Invalid task type' });
        }

        const task = new Task(taskData);
        await task.save();
        
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ 
            message: 'Error creating task', 
            error: error.message,
            details: error.stack
        });
    }
});

// Get tasks for a teacher
router.get('/teacher', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can access this endpoint' });
        }

        const tasks = await Task.find({ teacherId: req.user.id })
            .sort({ createdAt: -1 });

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tasks', error: error.message });
    }
});

// Get tasks by class ID (for students)
router.get('/class/:classId', verifyToken, async (req, res) => {
    try {
        // 1. Ensure the logged-in user is a student
        if (req.user.role !== 'student') {
            console.warn(`Access denied: User ${req.user.id} is not a student.`);
            return res.status(403).json({ message: 'Access denied. Only students can view tasks.' });
        }

        // 2. Find the student to get their assigned class
        const student = await Student.findById(req.user.id);

        if (!student) {
            console.warn(`Access denied: Student ${req.user.id} not found.`);
            return res.status(403).json({ message: 'Student not found' });
        }

        // 3. Check if the student has a class assigned
        if (!student.class) {
            console.warn(`Access denied: Student ${req.user.id} has no class assigned.`);
            return res.status(403).json({ message: 'No class assigned to student' });
        }

        // 4. Check if the student's class matches the requested classId
        const studentClassId = student.class.toString();
        const requestedClassId = req.params.classId;
        
        if (studentClassId !== requestedClassId) {
            console.warn(`Access denied: Student ${req.user.id} (class: ${studentClassId}) trying to access tasks for class ${requestedClassId}`);
            return res.status(403).json({ message: 'Access denied. You can only view tasks for your assigned class.' });
        }

        // If all checks pass, fetch the tasks for the requested classId
        const tasks = await Task.find({ class: req.params.classId })
            .populate('teacherId', 'name')
            .populate('class', 'name')
            .populate({
                path: 'submissions.studentId',
                select: 'name rollNumber'
            })
            .sort({ deadline: 1 });

        console.log(`Found ${tasks.length} tasks for class ${req.params.classId}`);
        res.status(200).json(tasks);

    } catch (error) {
        console.error('Error fetching tasks by class ID:', error);
        res.status(500).json({
            message: 'Error fetching tasks',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Submit task (Student only)
router.post('/:taskId/submit', verifyToken, upload.single('file'), async (req, res) => {
    try {
        if (req.user.role !== 'student') {
             // Clean up uploaded file if user is not a student
            if (req.file) {
                 console.log(`Attempting to delete file for non-student submission: ${req.file.path}`);
                 try {
                    const fs = require('fs');
                    fs.unlinkSync(req.file.path);
                     console.log(`Successfully deleted file: ${req.file.path}`);
                 } catch (deleteError) {
                     console.error(`Failed to delete file ${req.file.path}:`, deleteError);
                 }
            }
            return res.status(403).json({ message: 'Only students can submit tasks' });
        }

        const task = await Task.findById(req.params.taskId);
        if (!task) {
             // Clean up uploaded file if task is not found
             if (req.file) {
                 console.log(`Attempting to delete file for task not found: ${req.file.path}`);
                 try {
                    const fs = require('fs');
                    fs.unlinkSync(req.file.path);
                     console.log(`Successfully deleted file: ${req.file.path}`);
                 } catch (deleteError) {
                     console.error(`Failed to delete file ${req.file.path}:`, deleteError);
                 }
            }
            return res.status(404).json({ message: 'Task not found' });
        }

        const submission = {
            studentId: req.user.id,
            submittedAt: new Date(),
            status: new Date() > task.deadline ? 'late' : 'submitted'
        };

        // Add type-specific submission data
        switch (task.type) {
            case 'document':
                // For document tasks, ensure a file was uploaded and store its path
                if (!req.file) {
                    return res.status(400).json({ message: 'Document task requires a file submission' });
                }
                submission.fileUrl = req.file.path;
                break;
            case 'form':
                submission.formResponse = req.body.formResponse;
                 // Clean up unexpected file if uploaded for non-document task
                 if (req.file) {
                      console.log(`Attempting to delete unexpected file for non-document submission (${task.type}): ${req.file.path}`);
                      try {
                         const fs = require('fs');
                         fs.unlinkSync(req.file.path);
                          console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                      } catch (deleteError) {
                          console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                      }
                 }
                break;
            case 'hackathon':
                submission.hackathonSubmission = {
                    projectLink: req.body.projectLink,
                    teamDetails: req.body.teamDetails,
                    achievements: req.body.achievements
                };
                 // Clean up unexpected file if uploaded for non-document task
                 if (req.file) {
                      console.log(`Attempting to delete unexpected file for non-document submission (${task.type}): ${req.file.path}`);
                      try {
                         const fs = require('fs');
                         fs.unlinkSync(req.file.path);
                          console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                      } catch (deleteError) {
                          console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                      }
                 }
                break;
            case 'quiz':
                submission.quizScore = parseInt(req.body.quizScore);
                 // Clean up unexpected file if uploaded for non-document task
                 if (req.file) {
                      console.log(`Attempting to delete unexpected file for non-document submission (${task.type}): ${req.file.path}`);
                      try {
                         const fs = require('fs');
                         fs.unlinkSync(req.file.path);
                          console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                      } catch (deleteError) {
                          console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                      }
                 }
                break;
            case 'project':
                submission.projectSubmission = {
                    deliverables: req.body.deliverables.split(','),
                    documentation: req.body.documentation,
                    demoLink: req.body.demoLink
                };
                 // Clean up unexpected file if uploaded for non-document task
                 if (req.file) {
                      console.log(`Attempting to delete unexpected file for non-document submission (${task.type}): ${req.file.path}`);
                      try {
                         const fs = require('fs');
                         fs.unlinkSync(req.file.path);
                          console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                      } catch (deleteError) {
                          console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                      }
                 }
                break;
             default:
                 // Handle unknown task types and potential unexpected files
                 if (req.file) {
                      console.log(`Attempting to delete unexpected file for unknown task type submission (${task.type}): ${req.file.path}`);
                      try {
                         const fs = require('fs');
                         fs.unlinkSync(req.file.path);
                          console.log(`Successfully deleted unexpected file: ${req.file.path}`);
                      } catch (deleteError) {
                          console.error(`Failed to delete unexpected file ${req.file.path}:`, deleteError);
                      }
                 }
                 return res.status(400).json({ message: 'Invalid task type for submission' });
        }

        // Update or add submission
        const submissionIndex = task.submissions.findIndex(
            sub => sub.studentId.toString() === req.user.id
        );

        if (submissionIndex > -1) {
            // If there was a previous file submission, try to delete the old file
            if (task.submissions[submissionIndex].fileUrl && task.type === 'document') {
                 console.log(`Attempting to delete old submission file: ${task.submissions[submissionIndex].fileUrl}`);
                 try {
                    const fs = require('fs');
                    fs.unlinkSync(task.submissions[submissionIndex].fileUrl);
                     console.log(`Successfully deleted old submission file: ${task.submissions[submissionIndex].fileUrl}`);
                 } catch (deleteError) {
                     console.error(`Failed to delete old submission file ${task.submissions[submissionIndex].fileUrl}:`, deleteError);
                 }
            }
            task.submissions[submissionIndex] = submission;
        } else {
            task.submissions.push(submission);
        }

        await task.save();
        res.json({ message: 'Task submitted successfully', submission });
    } catch (error) {
         // Clean up uploaded file in case of any error during submission processing
         if (req.file) {
              console.log(`Attempting to delete file due to submission error: ${req.file.path}`);
              try {
                 const fs = require('fs');
                 fs.unlinkSync(req.file.path);
                  console.log(`Successfully deleted file: ${req.file.path}`);
              } catch (deleteError) {
                  console.error(`Failed to delete file ${req.file.path}:`, deleteError);
              }
         }
        console.error('Error submitting task:', error);
        res.status(500).json({ message: 'Error submitting task', error: error.message });
    }
});

// Get task submissions (Teacher only)
router.get('/:taskId/submissions', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const task = await Task.findById(req.params.taskId)
            .populate('teacherId', 'name')
            .populate('class', 'name')
            .populate({
                path: 'submissions.studentId',
                select: 'name rollNumber department'
            });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Calculate submission statistics
        const stats = {
            total: task.submissions.length,
            submitted: task.submissions.filter(sub => sub.status === 'submitted').length,
            late: task.submissions.filter(sub => sub.status === 'late').length,
            pending: task.submissions.filter(sub => sub.status === 'pending').length
        };

        res.json({
            task,
            submissions: task.submissions,
            statistics: stats
        });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ message: 'Error fetching submissions', error: error.message });
    }
});

// Download submission file
router.get('/submission/:taskId/:studentId', verifyToken, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const submission = task.submissions.find(
            sub => sub.studentId.toString() === req.params.studentId
        );

        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        if (task.type === 'document' && submission.fileUrl) {
            res.download(submission.fileUrl);
        } else {
            res.json(submission);
        }
    } catch (error) {
        res.status(500).json({ message: 'Error downloading file', error: error.message });
    }
});

module.exports = router; 