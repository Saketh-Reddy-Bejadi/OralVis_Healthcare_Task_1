const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, patientId } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // For patients, patientId is required and must be unique
    if (role === 'patient' || !role) {
      if (!patientId) {
        return res.status(400).json({ message: 'Patient ID is required for patient registration' });
      }
      
      const existingPatientId = await User.findOne({ patientId });
      if (existingPatientId) {
        return res.status(400).json({ message: 'Patient ID already exists' });
      }
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: role || 'patient',
      ...(role === 'patient' || !role ? { patientId } : {})
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password) and token
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      patientId: user.patientId
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userData,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password) and token
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      patientId: user.patientId
    };

    res.json({
      message: 'Login successful',
      user: userData,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Logout route (for client-side token management)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  const userData = {
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    patientId: req.user.patientId
  };
  
  res.json({ user: userData });
});

module.exports = router;
