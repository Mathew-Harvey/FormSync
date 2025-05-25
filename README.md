# FormSync - Real-time Collaborative Forms

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (running on localhost:27017)
- Python (for serving static files) or Node.js http-server

### Installation & Running

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Start the application:**
   
   **Option 1 - Using the batch file (Windows):**
   ```bash
   start-all.bat
   ```
   
   **Option 2 - Using PowerShell (Windows):**
   ```powershell
   .\start-all.ps1
   ```
   
   **Option 3 - Using npm (Cross-platform):**
   ```bash
   npm start
   ```

3. **Access the application:**
   - Open your browser to: http://localhost:8080
   - The server API runs on: http://localhost:3001

### Troubleshooting Connection Issues

If you see connection errors:

1. **Test the connection:**
   - Open http://localhost:8080/test-connection.html
   - You should see "✅ Connected to server!"

2. **Check services are running:**
   - Server should be on port 3001
   - Client should be on port 8080
   - MongoDB should be on port 27017

3. **Common fixes:**
   - Use `localhost` instead of `127.0.0.1` in your browser
   - Clear browser cache and reload
   - Check Windows Firewall isn't blocking the ports

---

## Overview

A modern web application for creating and collaborating on forms in real-time with integrated video chat functionality.

## Features

- 🚀 Real-time form collaboration
- 📹 Integrated video chat with WebRTC
- 🔒 Field locking to prevent conflicts
- 📸 Screenshot capture and sharing
- 📱 Responsive design
- 🎨 Beautiful UI with Tailwind CSS
- 🔄 Live updates with Socket.io
- 📊 Multiple form templates
- 👥 User presence indicators

## Tech Stack

### Frontend
- **Vanilla JavaScript** - No framework, just pure JS
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables
- **Socket.io Client** - Real-time communication
- **WebRTC** - Video/audio streaming
- **Local Storage** - Client-side persistence

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **Winston** - Logging

## Project Structure

```
FormSync/
├── public/                # Frontend static files
│   ├── index.html        # Main HTML file
│   ├── css/              # Stylesheets
│   │   ├── main.css      # Main styles
│   │   ├── components.css # Component styles
│   │   └── animations.css # Animations
│   ├── js/               # JavaScript files
│   │   ├── app.js        # Main app entry
│   │   ├── components/   # UI components
│   │   ├── services/     # Services (API, Socket, etc)
│   │   └── utils/        # Utility functions
│   └── assets/           # Images, fonts, etc
│
├── server/               # Node.js backend
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── package.json
│
├── shared/              # Shared constants
└── package.json         # Root package.json

```

## Prerequisites

- Node.js 16+ and npm 8+
- MongoDB 4.4+ (local or cloud instance)
- Modern web browser with WebRTC support

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/formsync.git
   cd formsync
   ```

2. **Install dependencies**
   ```bash
   cd server && npm install
   cd ..
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the server directory:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=3001

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/

   # Client URL
   CLIENT_URL=http://localhost:5173

   # JWT Secret
   JWT_SECRET=your-super-secret-jwt-key

   # Session Secret
   SESSION_SECRET=your-super-secret-session-key
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Run the application**
   
   Development mode (from root directory):
   ```bash
   npm run dev
   ```
   
   This will start the server on port 3001. The frontend is served directly by Express.

## Usage

1. **Access the application**
   - Open http://localhost:3001 in your browser

2. **Create a new form**
   - Enter your name
   - Click "Create New Form"
   - Select a template
   - Share the form code with collaborators

3. **Join an existing form**
   - Enter your name
   - Click "Join Existing"
   - Enter the 6-character form code

4. **Collaborate**
   - Edit form fields in real-time
   - See who's editing what with field locking
   - Use video chat to communicate
   - Take and share screenshots

## API Endpoints

### Forms
- `GET /api/forms/templates` - Get available form templates
- `POST /api/forms` - Create a new form
- `GET /api/forms/:formId` - Get form by ID
- `PATCH /api/forms/:formId` - Update form
- `DELETE /api/forms/:formId` - Delete form
- `GET /api/forms/user` - Get user's forms

### Authentication
- `POST /api/auth/login` - User login/registration (simplified)
- `GET /api/auth/user/:userId` - Get user by ID
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users (admin/debugging)
- `GET /api/users/:userId` - Get user details
- `PUT /api/users/:userId` - Update user data
- `POST /api/users/:userId/forms` - Add form to user's history
- `GET /api/users/:userId/forms` - Get user's form history

### Screenshots
- `POST /api/screenshots/upload` - Upload screenshot (multipart/form-data)
- `POST /api/screenshots/upload-base64` - Upload screenshot as base64
- `GET /api/screenshots/:screenshotId` - Get screenshot by ID
- `GET /api/screenshots/form/:formId` - Get all screenshots for a form
- `DELETE /api/screenshots/:screenshotId` - Delete screenshot

## Socket Events

### Client → Server
- `join_form` - Join a form session
- `field_lock` - Lock a field for editing
- `field_unlock` - Unlock a field
- `field_update` - Update field value
- `webrtc_offer` - Send WebRTC offer
- `webrtc_answer` - Send WebRTC answer
- `webrtc_ice_candidate` - Send ICE candidate
- `screenshot_added` - Add screenshot

### Server → Client
- `form_joined` - Successfully joined form
- `user_joined` - Another user joined
- `user_left` - User left the form
- `users_update` - Active users list updated
- `field_locked` - Field locked by user
- `field_unlocked` - Field unlocked
- `field_updated` - Field value updated
- `screenshot_added` - New screenshot available

## Development

### Code Style
- ESLint for JavaScript linting
- Prettier for code formatting
- Tailwind CSS for styling

### Testing
```bash
# Run server tests
cd server && npm test

# Run client tests
cd client && npm test
```

### Building for Production
```bash
# Build client
cd client && npm run build

# The built files will be in client/dist
```

## Deployment

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use secure JWT and session secrets
- Configure MongoDB Atlas or production database
- Set up proper CORS origins

### Recommended Platforms
- **Frontend**: Vercel, Netlify, or AWS S3 + CloudFront
- **Backend**: Heroku, Railway, or AWS EC2
- **Database**: MongoDB Atlas

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] User authentication and profiles
- [ ] Form templates marketplace
- [ ] Export forms to PDF/Excel
- [ ] Form analytics and insights
- [ ] Mobile app
- [ ] Offline support with sync
- [ ] Advanced permissions system
- [ ] Integration with third-party services
- [ ] AI-powered form suggestions

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Socket.io for real-time communication
- WebRTC for video chat functionality
- Tailwind CSS for the beautiful UI
- The open-source community for inspiration

---

Built with ❤️ by the FormSync team
