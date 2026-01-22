const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    department: { type: String }, // Can be a reference later
    credits: { type: Number }
});

const Subject = mongoose.model('Subject', subjectSchema);

module.exports = Subject; 