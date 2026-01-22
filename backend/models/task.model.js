const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    type: {
        type: String,
        enum: ['document', 'form', 'hackathon', 'quiz', 'project'],
        required: true
    },
    fileUrl: {
        type: String,
        required: function() {
            return this.type === 'document';
        }
    },
    formLink: {
        type: String,
        required: function() {
            return this.type === 'form';
        }
    },
    hackathonDetails: {
        startDate: Date,
        endDate: Date,
        platform: String,
        registrationLink: String,
        requirements: String
    },
    quizDetails: {
        totalQuestions: Number,
        timeLimit: Number,
        passingScore: Number,
        quizLink: String
    },
    projectDetails: {
        requirements: String,
        deliverables: [String],
        evaluationCriteria: [String]
    },
    deadline: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    submissions: [{
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student'
        },
        fileUrl: String,
        formResponse: Object,
        hackathonSubmission: {
            projectLink: String,
            teamDetails: String,
            achievements: String
        },
        quizScore: Number,
        projectSubmission: {
            deliverables: [String],
            documentation: String,
            demoLink: String
        },
        submittedAt: Date,
        status: {
            type: String,
            enum: ['pending', 'submitted', 'late'],
            default: 'pending'
        }
    }]
});

module.exports = mongoose.model('Task', taskSchema); 