import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', textAlign: 'center' }}>
      <h1>Welcome to DeckBuilder</h1>
      <p>Please sign in to save and manage your decks</p>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          padding: '10px',
          marginBottom: '20px',
          borderRadius: '4px',
          color: '#c00'
        }}>
          {error === 'auth_failed' && 'Authentication failed. Please try again.'}
          {error === 'no_token' && 'Authentication token not received. Please try again.'}
          {error && !['auth_failed', 'no_token'].includes(error) && `Error: ${error}`}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button
          onClick={() => login('google')}
          style={{
            padding: '12px 20px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Sign in with Google
        </button>

        <button
          onClick={() => login('facebook')}
          style={{
            padding: '12px 20px',
            backgroundColor: '#1877f2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Sign in with Facebook
        </button>
      </div>

      <p style={{ marginTop: '30px', color: '#666' }}>
        By signing in, you agree to our terms of service and privacy policy.
      </p>
    </div>
  );
};

export default Login;