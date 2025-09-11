const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const os = require('os');

const authRoutes = require('./routes/auth');
const submissionRoutes = require('./routes/submissions');

const app = express();

// CORS configuration
app.use(
  cors({
    origin: [
      "https://oralvis-healthcare-1.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads/images', express.static(path.join(os.tmpdir(), 'images')));
app.use('/uploads/annotated-images', express.static(path.join(os.tmpdir(), 'annotated-images')));
app.use('/uploads/reports', express.static(path.join(os.tmpdir(), 'reports')));

// MongoDB connection with fallback
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('❌ MONGODB_URI is not defined in your environment variables.');
  process.exit(1); // Exit the process with an error code
}

mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    if (error.name === 'MongooseServerSelectionError') {
      console.error('💡 This might be due to an IP whitelist issue. Make sure your current IP is whitelisted in your MongoDB Atlas cluster.');
    }
  });

app.use('/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Healthcare API is running!' });
});

app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ message: error.message || 'Something went wrong!' });
});

module.exports = app;
