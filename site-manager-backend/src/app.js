const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { startExpiryCron } = require('./cron/expiryCron');
const { sendOtpEmail } = require('./utils/mailer');

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['BREVO_API_KEY', 'ADMIN_EMAIL', 'FRONTEND_URL', 'JWT_SECRET'];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
  console.error('⚠️  Please check your .env file');
}

const app = express();
app.use(cookieParser());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/sites', require('./routes/siteRoutes'));
app.use('/api/workers', require('./routes/workerRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/salary', require('./routes/salaryRoutes'));
app.use('/api', require('./routes/ping'));
app.use('/api/advances', require('./routes/advance'));

// Test email endpoint - ONLY IN DEVELOPMENT
if (process.env.NODE_ENV !== 'production') {
  app.get("/test-email", async (req, res) => {
    try {
      console.log("🔍 Testing email service...");
      const result = await sendOtpEmail("varghesejoyel71@gmail.com", "123456");
      console.log("📧 Email test result:", result);
      res.status(200).json({ 
        message: "Test email sent successfully", 
        result 
      });
    } catch (error) {
      console.error('❌ Test email error:', error.message);
      res.status(500).json({ 
        error: "Failed to send test email", 
        details: error.message,
        brevoKey: process.env.BREVO_API_KEY ? "✅ Set" : "❌ Missing"
      });
    }
  });

  // Debug endpoint to check config
  app.get("/debug-config", (req, res) => {
    res.json({
      BREVO_API_KEY: process.env.BREVO_API_KEY ? "✅ Set (length: " + process.env.BREVO_API_KEY.length + ")" : "❌ Missing",
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ? "✅ " + process.env.ADMIN_EMAIL : "❌ Missing",
      FRONTEND_URL: process.env.FRONTEND_URL ? "✅ " + process.env.FRONTEND_URL : "❌ Missing",
      NODE_ENV: process.env.NODE_ENV || 'development'
    });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({ 
    error: err.message || 'Server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    startExpiryCron();
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      console.log(`📧 Email service: ${process.env.BREVO_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  });

// Export app
module.exports = app;