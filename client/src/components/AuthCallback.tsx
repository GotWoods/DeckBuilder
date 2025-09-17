import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Cookies from 'js-cookie';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      console.error('Authentication error:', error);
      navigate('/login?error=' + error);
      return;
    }

    if (token) {
      // Store the token in cookies
      Cookies.set('auth_token', token, { expires: 30 }); // 30 days

      // Redirect to home page
      navigate('/');
    } else {
      navigate('/login?error=no_token');
    }
  }, [navigate, searchParams]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Completing authentication...</h2>
      <p>Please wait while we log you in.</p>
    </div>
  );
};

export default AuthCallback;