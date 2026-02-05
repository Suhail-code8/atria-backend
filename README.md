# Atria Backend

Express.js backend for the Atria event management platform with authentication, event management, and submission tracking.

## Features

- User authentication (JWT-based)
- Event management
- Submission tracking
- Role-based access control
- Real-time updates with Socket.io

## Prerequisites

- Node.js (v18 or higher)
- MongoDB

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration:
   - `MONGO_URI`: MongoDB connection string
   - `ACCESS_TOKEN_SECRET`: Secret key for access tokens
   - `REFRESH_TOKEN_SECRET`: Secret key for refresh tokens
   - `PORT`: Server port (default: 5000)

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app.ts              # Express app setup
├── server.ts           # Server entry point
├── config/             # Configuration files
├── middlewares/        # Custom middleware
├── modules/            # Feature modules
│   ├── auth/          # Authentication
│   ├── events/        # Event management
│   ├── submissions/   # Submission handling
│   └── users/         # User management
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## API Routes

- `/api/auth/*` - Authentication endpoints
- `/api/events/*` - Event management endpoints
- `/api/users/*` - User endpoints
- `/api/submissions/*` - Submission endpoints

## Technologies Used

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **Real-time**: Socket.io
- **Language**: TypeScript

## License

ISC
