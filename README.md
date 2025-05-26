# Campus Flow - College Management System

A comprehensive college management system built with the MERN stack (MongoDB, Express.js, React, and Node.js) to streamline academic and administrative operations.

## Features

- Role-based access (Admin, Teacher, Student)
- User authentication and authorization
- Event and participation tracking
- Attendance management
- Internal marks management
- Fee tracking
- Announcements and notifications
- Real-time communication

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT
- **Other**: bcryptjs, cors

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Arya101005/Campus_Flow.git
   cd Campus_Flow
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```

## Project Structure

```
Campus_Flow/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── index.js
│   ├── .env
│   └── package.json
└── frontend/
    └── (coming soon)
```

## API Endpoints

### Authentication
- POST `/api/users/register` - Register a new user
- POST `/api/users/login` - Login user
- GET `/api/users/profile` - Get user profile (protected)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. 