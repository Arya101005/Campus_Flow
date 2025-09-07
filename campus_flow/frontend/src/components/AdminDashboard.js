import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [adminData, setAdminData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          window.location.href = '/login';
          return;
        }

        const response = await fetch('http://localhost:5000/api/admin/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (data.status === 'success') {
          setAdminData(data.data.admin);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError('Failed to fetch admin profile');
      }
    };

    fetchAdminProfile();
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      await fetch('http://localhost:5000/api/admin/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!adminData) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <nav className="dashboard-nav">
        <h1>Campus Flow Admin</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </nav>
      
      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome, {adminData.name}!</h2>
          <p>Last login: {new Date(adminData.lastLogin).toLocaleString()}</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h3>Students</h3>
            <p>Manage student records</p>
          </div>
          <div className="dashboard-card">
            <h3>Teachers</h3>
            <p>Manage teacher records</p>
          </div>
          <div className="dashboard-card">
            <h3>Departments</h3>
            <p>Manage departments</p>
          </div>
          <div className="dashboard-card">
            <h3>Courses</h3>
            <p>Manage courses</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 