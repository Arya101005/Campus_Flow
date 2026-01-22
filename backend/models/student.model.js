const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Generated email will be username
    password: { type: String, required: true }, // Hashed generated password
    rollNumber: { type: String, required: true, unique: true },
    department: { type: String, required: true }, // Can be a reference later
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    year: { type: Number },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

module.exports = Student; 