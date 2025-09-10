const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  // Patient details
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  // Backward compatibility: keep field name patientId but it's the mobile number
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
  
  // User who submitted
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Image paths (now arrays for multiple images)
  originalImagePaths: [{
    type: String,
    required: true
  }],
  annotatedImagePaths: [{
    type: String
  }],
  
  // Annotation data
  annotationData: {
    type: mongoose.Schema.Types.Mixed // Store JSON data for shapes, colors, etc.
  },
  
  // PDF report
  reportPath: {
    type: String
  },
  reportUrl: {
    type: String
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['uploaded', 'annotated', 'reported'],
    default: 'uploaded'
  },
  
  // Treatment recommendations
  treatmentRecommendations: {
    type: String,
    trim: true
  },
  
  // Admin who annotated
  annotatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Timestamps for different stages
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
