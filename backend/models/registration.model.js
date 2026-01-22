const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    registeredAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['registered', 'cancelled'],
        default: 'registered'
    }
});

// Compound index to prevent duplicate registrations
registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema); 