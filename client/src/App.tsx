import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import DeckList from './components/DeckList';
import DeckDetails from './components/DeckDetails';
import Login from './components/Login';
import AuthCallback from './components/AuthCallback';
import DeckImport from './components/DeckImport';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div style={{ minHeight: '100vh' }}>
          <Routes>
            <Route path="/" element={<DeckList />} />
            <Route path="/deck/:id" element={<DeckDetails />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/import" element={<DeckImport />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;