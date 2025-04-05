import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Map from '../components/Map';
import DailyLog from '../components/DailyLog';
import '../styles/TripDetails.css';

const TripDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/trips/${id}/`);
        setTrip(response.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch trip details");
      } finally {
        setLoading(false);
      }
    };
    fetchTrip();
  }, [id]);

  const updateTripWithRouteInfo = (routeInfo) => {
    setTrip(prevTrip => ({
      ...prevTrip,
      total_distance: routeInfo.totalDistance,
      estimated_time: routeInfo.estimatedTime,
      fuel_stops: routeInfo.fuelStops,
      rest_stops: routeInfo.restStops,
      weekly_limit_reached: routeInfo.weeklyLimitReached,
      daysArray: routeInfo.daysArray
    }));
  };

  if (loading) return <div className="loading-spinner">Loading trip details...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!trip) return <div>No trip data found</div>;

  return (
    <div className="trip-details-container">
      <div className="trip-header">
        <button 
          className="btn btn-outline-secondary back-btn"
          onClick={() => navigate('/')}
        >
          <i className="fas fa-arrow-left me-2"></i>
          Back to Trips
        </button>
        
        <h1>
          <i className="fas fa-route me-2"></i>
          Trip Details
        </h1>
        
        <button 
          className="btn btn-outline-primary edit-btn"
          onClick={() => navigate(`/trips/${id}/edit`)}
        >
          <i className="fas fa-edit me-2"></i>
          Edit Trip
        </button>
      </div>

      <div className="trip-info-section">
        <div className="info-card">
          <h3>
            <i className="fas fa-info-circle me-2"></i>
            Basic Information
          </h3>
          <div className="info-grid">
            <div>
              <label>Current Location</label>
              <p>{trip.current_location}</p>
            </div>
            <div>
              <label>Pickup Location</label>
              <p>{trip.pickup_location}</p>
            </div>
            <div>
              <label>Dropoff Location</label>
              <p>{trip.dropoff_location}</p>
            </div>
            <div>
              <label>Cycle Used</label>
              <p>{trip.cycle_used}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="map-section">
        <div className="section-header">
          <h3>
            <i className="fas fa-map-marked-alt me-2"></i>
            Route Map
          </h3>
        </div>
        <Map trip={trip} onRouteCalculated={updateTripWithRouteInfo} />
      </div>

      <div className="log-section">
        <div className="section-header">
          <h3>
            <i className="fas fa-clipboard-list me-2"></i>
            Daily Log
          </h3>
        </div>
        <DailyLog trip={trip} />
      </div>
    </div>
  );
};

export default TripDetails;
