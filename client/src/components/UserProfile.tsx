import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const UserProfile: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      {user.avatar && (
        <img
          src={user.avatar}
          alt={user.name}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%'
          }}
        />
      )}
      <div>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{user.name}</div>
        <div style={{ fontSize: '12px', color: '#666' }}>{user.email}</div>
      </div>
      <button
        onClick={logout}
        style={{
          padding: '6px 12px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default UserProfile;