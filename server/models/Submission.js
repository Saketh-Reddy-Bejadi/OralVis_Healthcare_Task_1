const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  note: {
    type: String,
    trim: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  originalImagePaths: [{
    type: String,
    required: true
  }],
  annotatedImagePaths: [{
    type: String
  }],
  
  annotationData: {
    type: mongoose.Schema.Types.Mixed
  },
  
  reportPath: {
    type: String
  },
  reportUrl: {
    type: String
  },
  
  status: {
    type: String,
    enum: ['uploaded', 'annotated', 'reported'],
    default: 'uploaded'
  },
  
  treatmentRecommendations: {
    type: String,
    trim: true
  },
  
  annotatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  annotatedAt: {
    type: Date
  },
  reportGeneratedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Submission', submissionSchema);
