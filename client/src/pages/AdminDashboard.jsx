import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { submissionAPI, getFileUrl } from '../services/api';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setIsLoading(true);
      const response = await submissionAPI.getAllSubmissions();
      setSubmissions(response.data.submissions);
    } catch (error) {
      console.error('Error loading submissions:', error);
      setError('Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSubmissions = filterStatus === 'all' 
    ? submissions 
    : submissions.filter(s => s.status === filterStatus);

  const getStatusBadge = (status) => {
    const baseClasses = 'status-badge';
    switch (status) {
      case 'uploaded':
        return `${baseClasses} status-uploaded`;
      case 'annotated':
        return `${baseClasses} status-annotated`;
      case 'reported':
        return `${baseClasses} status-reported`;
      default:
        return baseClasses;
    }
  };

  const generateReport = async (submissionId) => {
    try {
      await submissionAPI.generateReport(submissionId);
      // Reload submissions to get updated status
      loadSubmissions();
    } catch (error) {
      console.error('Error generating report:', error);
      const message = error.response?.data?.message || 'Failed to generate report';
      setError(message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.name}</p>
            </div>
            <button onClick={logout} className="text-gray-500 hover:text-gray-700 px-3 py-2">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{submissions.length}</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Submissions</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {submissions.filter(s => s.status === 'uploaded').length}
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {submissions.filter(s => s.status === 'annotated').length}
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Annotated</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {submissions.filter(s => s.status === 'reported').length}
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Patient Submissions</h2>
              <div className="flex items-center space-x-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="uploaded">Pending Review</option>
                  <option value="annotated">Annotated</option>
                  <option value="reported">Completed</option>
                </select>
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No submissions found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No submissions match the current filter.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Images
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSubmissions.map((submission) => (
                      <tr key={submission._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {(submission.originalImagePaths || [submission.originalImagePath]).filter(Boolean).slice(0, 3).map((imagePath, index) => (
                              <img
                                key={index}
                                src={getFileUrl(imagePath)}
                                alt={`Dental scan ${index + 1}`}
                                className="h-12 w-12 object-cover rounded border"
                              />
                            ))}
                            {(submission.originalImagePaths || [submission.originalImagePath]).filter(Boolean).length > 3 && (
                              <div className="h-12 w-12 bg-gray-200 rounded border flex items-center justify-center text-xs text-gray-600">
                                +{(submission.originalImagePaths || [submission.originalImagePath]).filter(Boolean).length - 3}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {(submission.originalImagePaths || [submission.originalImagePath]).filter(Boolean).length} images
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {submission.patientName}
                          </div>
                          <div className="text-sm text-gray-500">
                            Mobile: {submission.mobileNumber || submission.patientId}
                          </div>
                          <div className="text-sm text-gray-500">
                            {submission.email}
                          </div>
                          {submission.note && (
                            <div className="text-sm text-gray-500 mt-1">
                              Note: {submission.note}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getStatusBadge(submission.status)}>
                            {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{new Date(submission.uploadedAt).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(submission.uploadedAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-y-1">
                          {submission.status === 'uploaded' && (
                            <Link
                              to={`/admin/annotate/${submission._id}`}
                              className="block text-primary-600 hover:text-primary-900"
                            >
                              Annotate
                            </Link>
                          )}
                          {submission.status === 'annotated' && (
                            <>
                              <Link
                                to={`/admin/annotate/${submission._id}`}
                                className="block text-primary-600 hover:text-primary-900"
                              >
                                View/Edit
                              </Link>
                              <button
                                onClick={() => generateReport(submission._id)}
                                className="block text-green-600 hover:text-green-900"
                              >
                                Generate Report
                              </button>
                            </>
                          )}
                          {submission.status === 'reported' && submission.reportPath && (
                            <a
                              href={getFileUrl(submission.reportPath)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-green-600 hover:text-green-900"
                            >
                              View Report
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
