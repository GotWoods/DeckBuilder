import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DeckList from './components/DeckList';
import DeckDetails from './components/DeckDetails';

const App: React.FC = () => {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<DeckList />} />
          <Route path="/deck/:id" element={<DeckDetails />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;