import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TripsList from './pages/TripsList';
import AddEditTrip from './pages/AddEditTrip';
import TripDetails from './pages/TripDetails';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<TripsList />} />
          <Route path="/trips/new" element={<AddEditTrip />} />
          <Route path="/trips/:id/edit" element={<AddEditTrip />} />
          <Route path="/trips/:id" element={<TripDetails />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
