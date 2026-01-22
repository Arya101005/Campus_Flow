const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
    day: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    subject: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject', 
        required: true 
    },
    teacher: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Teacher', 
        required: true 
    },
    class: { type: String, required: true }, // e.g., 'FY-IT', 'SY-CS'
    department: { type: String, required: true } // e.g., 'IT', 'CS'
});

const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable; 