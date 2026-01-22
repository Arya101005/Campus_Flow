const express = require('express');
const router = express.Router();
const Event = require('../models/event.model');
const Registration = require('../models/registration.model');
const Student = require('../models/student.model');
const { verifyToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Add new event (Admin only)
router.post('/add', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can create events' });
        }

        const { title, description, deadline, formLink } = req.body;
        const event = new Event({
            title,
            description,
            deadline,
            formLink
        });

        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: 'Error creating event', error: error.message });
    }
});

// Get all events (Admin only)
router.get('/all', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const events = await Event.find().sort({ createdAt: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching events', error: error.message });
    }
});

// Get upcoming events (Student view)
router.get('/upcoming', verifyToken, async (req, res) => {
    try {
        const events = await Event.find({
            deadline: { $gt: new Date() },
            status: 'upcoming'
        }).sort({ deadline: 1 });

        // For each event, check if the student is registered
        const eventsWithRegistration = await Promise.all(events.map(async (event) => {
            const registration = await Registration.findOne({
                eventId: event._id,
                userId: req.user.id,
                status: 'registered'
            });
            return {
                ...event.toObject(),
                isRegistered: !!registration
            };
        }));

        res.json(eventsWithRegistration);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching upcoming events', error: error.message });
    }
});

// Register for an event (Student only)
router.post('/register', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can register for events' });
        }

        const { eventId } = req.body;
        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        if (new Date() > event.deadline) {
            return res.status(400).json({ message: 'Registration deadline has passed' });
        }

        const registration = new Registration({
            eventId,
            userId: req.user.id
        });

        await registration.save();
        res.status(201).json({ message: 'Successfully registered for the event' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Already registered for this event' });
        }
        res.status(500).json({ message: 'Error registering for event', error: error.message });
    }
});

// Get registrations for an event (Admin only)
router.get('/:id/registrations', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const registrations = await Registration.find({ eventId: req.params.id })
            .populate('userId', 'name email rollNumber department')
            .sort({ registeredAt: -1 });

        res.json(registrations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching registrations', error: error.message });
    }
});

// Export registrations as PDF
router.get('/:id/registrations/pdf', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const event = await Event.findById(req.params.id);
        const registrations = await Registration.find({ eventId: req.params.id })
            .populate('userId', 'name email rollNumber department');

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${event.title}-registrations.pdf`);

        doc.pipe(res);
        doc.fontSize(20).text(event.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text('Registrations List', { align: 'center' });
        doc.moveDown();

        registrations.forEach((reg, index) => {
            doc.fontSize(10).text(`${index + 1}. ${reg.userId.name}`);
            doc.text(`   Roll Number: ${reg.userId.rollNumber}`);
            doc.text(`   Department: ${reg.userId.department}`);
            doc.text(`   Email: ${reg.userId.email}`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
});

// Export registrations as CSV
router.get('/:id/registrations/csv', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const event = await Event.findById(req.params.id);
        const registrations = await Registration.find({ eventId: req.params.id })
            .populate('userId', 'name email rollNumber department');

        const csvWriter = createCsvWriter({
            path: `${event.title}-registrations.csv`,
            header: [
                { id: 'name', title: 'Name' },
                { id: 'rollNumber', title: 'Roll Number' },
                { id: 'department', title: 'Department' },
                { id: 'email', title: 'Email' },
                { id: 'registeredAt', title: 'Registration Date' }
            ]
        });

        const records = registrations.map(reg => ({
            name: reg.userId.name,
            rollNumber: reg.userId.rollNumber,
            department: reg.userId.department,
            email: reg.userId.email,
            registeredAt: reg.registeredAt.toLocaleDateString()
        }));

        await csvWriter.writeRecords(records);
        res.download(`${event.title}-registrations.csv`);
    } catch (error) {
        res.status(500).json({ message: 'Error generating CSV', error: error.message });
    }
});

// Update event (Admin only)
router.put('/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const event = await Event.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Error updating event', error: error.message });
    }
});

// Delete event (Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Also delete all registrations for this event
        await Registration.deleteMany({ eventId: req.params.id });

        res.json({ message: 'Event and its registrations deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting event', error: error.message });
    }
});

module.exports = router; 