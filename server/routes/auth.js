const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, mobileNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    if (mobileNumber) {
      const cleanMobile = mobileNumber.replace(/[\s\-\+\(\)]/g, '');
      if (!/^[0-9]{10,15}$/.test(cleanMobile)) {
        return res.status(400).json({ message: 'Please provide a valid mobile number (10-15 digits)' });
      }
    }

    const user = new User({
      name,
      email,
      password,
      role: role || 'patient',
      mobileNumber: mobileNumber?.trim() || '',
      ...(mobileNumber ? { patientId: mobileNumber.trim() } : {})
    });

    await user.save();

    const token = generateToken(user._id);
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
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

router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});
router.get('/profile', authenticateToken, (req, res) => {
  const userData = {
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    mobileNumber: req.user.mobileNumber,
    role: req.user.role,
    patientId: req.user.patientId
  };
  
  res.json({ user: userData });
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;
    const userId = req.user._id;
    
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    if (mobileNumber) {
      const cleanMobile = mobileNumber.replace(/[\s\-\+\(\)]/g, '');
      if (!/^[0-9]{10,15}$/.test(cleanMobile)) {
        return res.status(400).json({ message: 'Please provide a valid mobile number (10-15 digits)' });
      }
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        name: name.trim(),
        mobileNumber: mobileNumber?.trim() || ''
      },
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userData = {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      mobileNumber: updatedUser.mobileNumber,
      role: updatedUser.role,
      patientId: updatedUser.patientId
    };
    
    res.json({ 
      message: 'Profile updated successfully',
      user: userData 
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

module.exports = router;
