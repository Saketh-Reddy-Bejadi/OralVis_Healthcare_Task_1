import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submissionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Upload = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    patientName: '',
    mobileNumber: '',
    email: '',
    note: ''
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Sequential image upload system
  const [currentStep, setCurrentStep] = useState(0); // 0: form, 1: upper, 2: front, 3: lower, 4: review
  const [uploadedImages, setUploadedImages] = useState({
    upper: null,
    front: null,
    lower: null
  });
  const [imagePreviews, setImagePreviews] = useState({
    upper: null,
    front: null,
    lower: null
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const imageSteps = [
    {
      key: 'upper',
      title: 'Upper Teeth',
      description: 'Take a photo showing your upper teeth clearly',
      instruction: 'Open your mouth and show your upper teeth. Make sure the image is clear and well-lit.',
      icon: '🦷'
    },
    {
      key: 'front',
      title: 'Front Teeth',
      description: 'Take a photo showing your front teeth (smile)',
      instruction: 'Smile naturally to show your front teeth. Ensure good lighting and focus.',
      icon: '😊'
    },
    {
      key: 'lower',
      title: 'Lower Teeth',
      description: 'Take a photo showing your lower teeth clearly',
      instruction: 'Open your mouth and show your lower teeth. Make sure all teeth are visible.',
      icon: '🦷'
    }
  ];
  
  // Populate form data from user profile on component mount
  useEffect(() => {
    if (user) {
      setFormData({
        patientName: user.name || '',
        mobileNumber: user.mobileNumber || '',
        email: user.email || '',
        note: ''
      });
      
      // Skip to image upload if user has complete profile data
      if (user.name && user.mobileNumber && user.email) {
        setCurrentStep(1);
      }
    }
  }, [user]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const validateForm = () => {
    if (!formData.patientName.trim()) {
      setError('Patient name is required');
      return false;
    }
    if (!formData.mobileNumber.trim()) {
      setError('Mobile number is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    // Validate mobile number
    const cleanMobile = formData.mobileNumber.replace(/[\s\-\+\(\)]/g, '');
    if (!/^[0-9]{10,15}$/.test(cleanMobile)) {
      setError('Please enter a valid mobile number (10-15 digits)');
      return false;
    }
    
    return true;
  };
  
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError(null);
    
    if (validateForm()) {
      setCurrentStep(1); // Move to first image step
    }
  };
  
  const handleProfileUpdate = async () => {
    setError(null);
    
    if (!validateForm()) return;
    
    try {
      const result = await updateProfile({
        name: formData.patientName,
        mobileNumber: formData.mobileNumber
      });
      
      if (result.success) {
        setIsEditingProfile(false);
        setCurrentStep(1); // Proceed to image upload
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    }
  };
  
  const handleImageUpload = (e, imageType) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }
    
    setUploadedImages(prev => ({ ...prev, [imageType]: file }));
    
    // Generate preview
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreviews(prev => ({ ...prev, [imageType]: reader.result }));
    };
    reader.readAsDataURL(file);
    
    setError(null);
  };
  
  const removeImage = (imageType) => {
    setUploadedImages(prev => ({ ...prev, [imageType]: null }));
    setImagePreviews(prev => ({ ...prev, [imageType]: null }));
  };
  
  const nextStep = () => {
    const currentImageType = imageSteps[currentStep - 1]?.key;
    if (currentImageType && !uploadedImages[currentImageType]) {
      setError(`Please upload the ${imageSteps[currentStep - 1].title} image`);
      return;
    }
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleFinalSubmit = async () => {
    setError(null);
    
    // Validate all images are uploaded
    if (!uploadedImages.upper || !uploadedImages.front || !uploadedImages.lower) {
      setError('Please upload all 3 required images');
      return;
    }
    
    try {
      setIsLoading(true);
      const fd = new FormData();
      
      // Append form data
      fd.append('patientName', formData.patientName);
      fd.append('mobileNumber', formData.mobileNumber);
      fd.append('email', formData.email);
      fd.append('note', formData.note);
      
      // Append images in correct order: upper, front, lower
      fd.append('images', uploadedImages.upper);
      fd.append('images', uploadedImages.front);
      fd.append('images', uploadedImages.lower);
      
      await submissionAPI.upload(fd);
      navigate('/dashboard');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step progress component
  const StepProgress = () => (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {['Info', 'Upper', 'Front', 'Lower', 'Review'].map((step, index) => (
          <div key={step} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
              index <= currentStep 
                ? 'bg-primary-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              index <= currentStep ? 'text-primary-600' : 'text-gray-500'
            }`}>
              {step}
            </span>
            {index < 4 && (
              <div className={`w-8 h-0.5 ml-4 mr-4 ${
                index < currentStep ? 'bg-primary-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Dental Health Submission</h1>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="text-primary-600 hover:text-primary-800 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>

        <StepProgress />

        <div className="bg-white shadow rounded-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Step 0: Patient Information Form */}
          {currentStep === 0 && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Information</h2>
                <p className="text-gray-600">
                  {user && user.name && user.mobileNumber && user.email 
                    ? "Your information is prefilled. Click 'Edit' if you need to make changes."
                    : "Please provide your details to get started"
                  }
                </p>
              </div>
              
              {/* Show current data with edit option */}
              {!isEditingProfile && user && user.name && user.mobileNumber && user.email ? (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div><strong>Name:</strong> {formData.patientName}</div>
                      <div><strong>Mobile:</strong> {formData.mobileNumber}</div>
                      <div className="md:col-span-2"><strong>Email:</strong> {formData.email}</div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea 
                      name="note" 
                      value={formData.note} 
                      onChange={handleChange} 
                      rows={4} 
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 px-4 py-3"
                      placeholder="Any specific concerns or symptoms?"
                    />
                  </div>
                  
                  <div className="flex space-x-4">
                    <button 
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                    >
                      ✏️ Edit Information
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="flex-1 bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700"
                    >
                      Continue to Image Upload
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input 
                    name="patientName" 
                    value={formData.patientName} 
                    onChange={handleChange} 
                    required 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 px-4 py-3"
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number *
                  </label>
                  <input 
                    name="mobileNumber" 
                    value={formData.mobileNumber} 
                    onChange={handleChange} 
                    required 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 px-4 py-3"
                    placeholder="Enter your mobile number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    required 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 px-4 py-3"
                    placeholder="Enter your email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea 
                    name="note" 
                    value={formData.note} 
                    onChange={handleChange} 
                    rows={4} 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 px-4 py-3"
                    placeholder="Any specific concerns or symptoms?"
                  />
                </div>
                
                <div className="flex space-x-4">
                  {isEditingProfile && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(false);
                        // Reset form data to user data
                        if (user) {
                          setFormData({
                            patientName: user.name || '',
                            mobileNumber: user.mobileNumber || '',
                            email: user.email || '',
                            note: formData.note
                          });
                        }
                      }}
                      className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type={isEditingProfile ? "button" : "submit"}
                    onClick={isEditingProfile ? handleProfileUpdate : undefined}
                    className="flex-1 bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    {isEditingProfile ? 'Save & Continue' : 'Continue to Image Upload'}
                  </button>
                </div>
              </form>
              )}
            </div>
          )}

          {/* Steps 1-3: Image Upload Steps */}
          {currentStep >= 1 && currentStep <= 3 && (
            <div>
              {(() => {
                const step = imageSteps[currentStep - 1];
                return (
                  <div>
                    <div className="text-center mb-8">
                      <div className="text-4xl mb-4">{step.icon}</div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{step.title}</h2>
                      <p className="text-gray-600 mb-2">{step.description}</p>
                      <p className="text-sm text-gray-500">{step.instruction}</p>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors">
                        {imagePreviews[step.key] ? (
                          <div className="space-y-4">
                            <img 
                              src={imagePreviews[step.key]} 
                              alt={step.title}
                              className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                            />
                            <div className="flex justify-center space-x-4">
                              <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                                📷 Retake Photo
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden"
                                  onChange={(e) => handleImageUpload(e, step.key)}
                                />
                              </label>
                              <button 
                                onClick={() => removeImage(step.key)}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                              >
                                🗑 Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <div className="space-y-4">
                              <div className="text-6xl">📷</div>
                              <div>
                                <p className="text-lg font-medium text-gray-700">Click to upload {step.title}</p>
                                <p className="text-sm text-gray-500">JPEG, PNG up to 10MB</p>
                              </div>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, step.key)}
                            />
                          </label>
                        )}
                      </div>
                      
                      <div className="flex justify-between">
                        <button 
                          onClick={prevStep}
                          className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                        >
                          ← Previous
                        </button>
                        <button 
                          onClick={nextStep}
                          disabled={!uploadedImages[step.key]}
                          className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {currentStep === 3 ? 'Review & Submit' : 'Next →'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 4: Review and Submit */}
          {currentStep === 4 && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Submission</h2>
                <p className="text-gray-600">Please review your information and images before submitting</p>
              </div>
              
              {/* Patient Info Review */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><strong>Name:</strong> {formData.patientName}</div>
                  <div><strong>Mobile:</strong> {formData.mobileNumber}</div>
                  <div><strong>Email:</strong> {formData.email}</div>
                  {formData.note && <div className="md:col-span-2"><strong>Note:</strong> {formData.note}</div>}
                </div>
              </div>
              
              {/* Images Review */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Dental Images (3)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {imageSteps.map((step, index) => (
                    <div key={step.key} className="text-center">
                      <div className="bg-gray-100 rounded-lg p-4 mb-3">
                        {imagePreviews[step.key] ? (
                          <img 
                            src={imagePreviews[step.key]} 
                            alt={step.title}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-32 flex items-center justify-center text-gray-400">
                            No image
                          </div>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">{step.title}</p>
                      <p className="text-xs text-gray-500">Image {index + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                <button 
                  onClick={prevStep}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  ← Previous
                </button>
                <button 
                  onClick={handleFinalSubmit}
                  disabled={isLoading}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>✓ Submit for Review</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;

