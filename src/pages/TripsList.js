import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTruck, faCompass, faSpinner } from '@fortawesome/free-solid-svg-icons';
import TripCard from '../components/TripCard';
import '../styles/TripsList.css';

const TripsList = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/trips/`);
        setTrips(response.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch trips");
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/trips/${id}/`);
      setTrips(trips.filter(trip => trip.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete trip");
    }
  };

  if (loading) return (
    <div className="loading-state">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      >
        <FontAwesomeIcon icon={faSpinner} size="2x" className="spinner-icon" />
      </motion.div>
      <h3>Loading your trips...</h3>
    </div>
  );
  
  if (error) return (
    <div className="error-state">
      <div className="error-icon">!</div>
      <h3>Oops! Something went wrong</h3>
      <p>{error}</p>
      <button 
        className="retry-btn"
        onClick={() => window.location.reload()}
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="trips-list-container">
      <div className="header-section">
        <h1 className="page-title">
          <FontAwesomeIcon icon={faTruck} className="title-icon" />
          My Trips
        </h1>
        <motion.button
          className="add-trip-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/trips/new')}
        >
          <FontAwesomeIcon icon={faPlus} className="btn-icon" />
          <span>Add New Trip</span>
        </motion.button>
      </div>

      <div className="trips-grid">
        {trips.length > 0 ? (
          trips.map((trip, index) => (
            <TripCard 
              key={trip.id}
              trip={trip}
              index={index}
              onEdit={() => navigate(`/trips/${trip.id}/edit`)}
              onView={() => navigate(`/trips/${trip.id}`)}
              onDelete={() => handleDelete(trip.id)}
            />
          ))
        ) : (
            <div className="no-trips">
                <div className="empty-state-icon">
                <FontAwesomeIcon icon={faCompass} />
                </div>
                <h3>No Trips Yet</h3>
                <p>You haven't created any trips yet. Start your journey by adding your first trip!</p>
                <motion.button
                className="empty-state-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/trips/new')}
                >
                <FontAwesomeIcon icon={faPlus} />
                Create First Trip
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripsList;