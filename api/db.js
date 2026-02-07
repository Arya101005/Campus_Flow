const mongoose = require('mongoose');
const config = require('../backend/config');

// Global variable to cache the connection
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        cached.promise = mongoose.connect(config.MONGODB_URI, opts).then((mongoose) => {
            console.log('MongoDB connected successfully');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error('MongoDB connection error:', e);
        throw e;
    }

    return cached.conn;
}

// For Vercel serverless, we'll create a helper that returns connection or null
async function getDB() {
    try {
        await connectDB();
        return mongoose.connection;
    } catch (error) {
        console.error('Failed to get database connection:', error);
        return null;
    }
}

module.exports = { connectDB, getDB, mongoose };
