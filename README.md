# Campus_Flow

A comprehensive web application for educational institutions to manage academic and extracurricular workflows.

## Features

- **Admin Dashboard**
  - Student and teacher management
  - Department and class-wise organization
  - Timetable management
  - Attendance tracking
  - Internal marks management
  - Fee management

- **Teacher Dashboard**
  - Task upload and management
  - Attendance recording
  - Marks posting
  - Student submission tracking

- **Student Dashboard**
  - Event registration (hackathons, internships, symposiums)
  - Assignment access and submission
  - Form submissions
  - Academic record viewing

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB Atlas
- Authentication: Role-based login system

## Project Structure

```
Campus_Flow/
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── pages/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── middleware/
└── docs/
```

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Create a `.env` file in the backend directory
   - Add required environment variables (see .env.example)

4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env` file with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 