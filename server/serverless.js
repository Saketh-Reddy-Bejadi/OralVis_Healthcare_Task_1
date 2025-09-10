const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Import routes
const authRoutes = require('./routes/auth');
const submissionRoutes = require('./routes/submissions');

dotenv.config();

const app = express();

// CORS: allow configured frontend origin or all in dev
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({
  origin: [
    'https://oralvis-healthcare-1.vercel.app'
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files (note: on Vercel, runtime FS is read-only)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to Mongo only once (serverless cold start safe)
if (!global.__mongooseConnected) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is not set');
  } else {
    mongoose
      .connect(uri)
      .then(() => {
        console.log('Connected to MongoDB');
        global.__mongooseConnected = true;
      })
      .catch((error) => console.error('MongoDB connection error:', error));
  }
}

// Routes
app.use('/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Healthcare API (serverless)' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ message: error.message || 'Something went wrong!' });
});

module.exports = app;


