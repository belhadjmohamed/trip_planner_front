import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, 
  faSave, 
  faMapMarkerAlt, 
  faBicycle, 
  faExclamationCircle,
  faSpinner,
  faMap,
  faKeyboard
} from '@fortawesome/free-solid-svg-icons';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/TripForm.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

const LocationMarker = ({ position, setPosition }) => {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>Selected Location</Popup>
    </Marker>
  );
};

const AddEditTrip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    cycle_used: '',
    current_lat: null,
    current_lng: null,
    pickup_lat: null,
    pickup_lng: null,
    dropoff_lat: null,
    dropoff_lng: null
  });
  const [suggestions, setSuggestions] = useState({
    current_location: [],
    pickup_location: [],
    dropoff_location: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [inputMethod, setInputMethod] = useState('form');
  const [mapPosition, setMapPosition] = useState(null);
  const [selectedField, setSelectedField] = useState(null);
  const formRef = useRef(null);
  const dropdownRefs = useRef({});
  const mapContainerRef = useRef(null);
  const [mapHeight, setMapHeight] = useState('400px');

  useEffect(() => {
    const updateMapHeight = () => {
      if (mapContainerRef.current) {
        setMapHeight(`${mapContainerRef.current.clientHeight}px`);
      }
    };

    updateMapHeight();
    window.addEventListener('resize', updateMapHeight);
    return () => window.removeEventListener('resize', updateMapHeight);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        const isOutsideAllDropdowns = Object.values(dropdownRefs.current).every(
          ref => !ref?.contains(event.target)
        );
        if (isOutsideAllDropdowns) {
          setActiveField(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (id) {
      setIsEditing(true);
      const fetchTrip = async () => {
        try {
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/trips/${id}/`);
          setTrip(response.data);
        } catch (err) {
          setError(err.response?.data?.message || "Failed to fetch trip");
        }
      };
      fetchTrip();
    }
  }, [id]);

  const handleSearch = async (e, field) => {
    const query = e.target.value;
    setTrip({ 
      ...trip, 
      [field]: query,
      [`${field}_lat`]: null,
      [`${field}_lng`]: null
    });
    setActiveField(field);
    
    if (field !== 'cycle_used' && query.length > 2) {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/locations/?query=${query}`);
        setSuggestions(prev => ({ ...prev, [field]: response.data }));
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    } else if (field !== 'cycle_used') {
      setSuggestions(prev => ({ ...prev, [field]: [] }));
    }
  };

  const handleSelect = (field, suggestion) => {
    setTrip({ 
      ...trip, 
      [field]: suggestion.name,
      [`${field}_lat`]: suggestion.lat,
      [`${field}_lng`]: suggestion.lng
    });
    setSuggestions(prev => ({ ...prev, [field]: [] }));
    setActiveField(null);
  };

  const handleMapSelect = (field) => {
    setSelectedField(field);
    setInputMethod('map');
    setMapPosition(null);
  };

  const confirmMapLocation = async () => {
    if (mapPosition && selectedField) {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${mapPosition.lat}&lon=${mapPosition.lng}`
        );
        
        const address = response.data.display_name || `Location at ${mapPosition.lat.toFixed(4)}, ${mapPosition.lng.toFixed(4)}`;
        
        setTrip({ 
          ...trip, 
          [selectedField]: address,
          [`${selectedField}_lat`]: mapPosition.lat,
          [`${selectedField}_lng`]: mapPosition.lng
        });
        
        setInputMethod('form');
        setSelectedField(null);
        setMapPosition(null);
      } catch (err) {
        console.error("Error reverse geocoding:", err);
        setTrip({ 
          ...trip, 
          [selectedField]: `Location at ${mapPosition.lat.toFixed(4)}, ${mapPosition.lng.toFixed(4)}`,
          [`${selectedField}_lat`]: mapPosition.lat,
          [`${selectedField}_lng`]: mapPosition.lng
        });
        setInputMethod('form');
        setSelectedField(null);
        setMapPosition(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isEditing) {
        await axios.put(`${process.env.REACT_APP_API_URL}/api/trips/${id}/`, trip);
        navigate(`/trips/${id}`);
      } else {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/trips/`, trip);
        navigate(`/trips/${response.data.trip.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save trip");
    } finally {
      setLoading(false);
    }
  };

  const fieldIcons = {
    current_location: faMapMarkerAlt,
    pickup_location: faMapMarkerAlt,
    dropoff_location: faMapMarkerAlt,
    cycle_used: faBicycle
  };

  return (
    <div className="trip-form-container">
      <div className="form-card-wrapper">
        <motion.div 
          className="form-card"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4 }}
          ref={formRef}
        >
          <div className="form-header">
            <h2>
              <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
              {isEditing ? 'Edit Trip' : 'Create New Trip'}
            </h2>
            <motion.button 
              className="btn btn-back"
              whileHover={{ x: -3 }}
              onClick={() => navigate('/')}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
              Back
            </motion.button>
          </div>

          <div className="input-method-toggle">
            <button
              className={`toggle-btn ${inputMethod === 'form' ? 'active' : ''}`}
              onClick={() => setInputMethod('form')}
            >
              <FontAwesomeIcon icon={faKeyboard} />
              <span>Form Input</span>
            </button>
            <button
              className={`toggle-btn ${inputMethod === 'map' ? 'active' : ''}`}
              onClick={() => setInputMethod('map')}
            >
              <FontAwesomeIcon icon={faMap} />
              <span>Map Input</span>
            </button>
          </div>

          {error && (
            <motion.div 
              className="alert-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FontAwesomeIcon icon={faExclamationCircle} className="me-2" />
              {error}
            </motion.div>
          )}

          {inputMethod === 'form' ? (
            <form onSubmit={handleSubmit}>
              {['current_location', 'pickup_location', 'dropoff_location', 'cycle_used'].map((field) => (
                <div className="form-group-container" key={field}>
                  <motion.div 
                    className="form-group"
                    whileHover={{ x: 5 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <label>
                      <FontAwesomeIcon icon={fieldIcons[field]} className="me-2" />
                      {field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      {trip[`${field}_lat`] && trip[`${field}_lng`] && (
                        <span className="coordinates-badge">
                          Coordinates saved
                        </span>
                      )}
                    </label>
                    <div className="input-with-map-btn">
                      <input
                        type={field === 'cycle_used' ? 'number' : 'text'}
                        className="form-control"
                        value={trip[field]}
                        onChange={(e) => handleSearch(e, field)}
                        onFocus={() => setActiveField(field)}
                        placeholder={`Enter ${field.split('_').join(' ')}`}
                        required
                      />
                      {field !== 'cycle_used' && (
                        <button
                          type="button"
                          className="map-select-btn"
                          onClick={() => handleMapSelect(field)}
                        >
                          <FontAwesomeIcon icon={faMap} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                  
                  {activeField === field && suggestions[field] && suggestions[field].length > 0 && (
                    <div 
                      className="suggestions-dropdown-wrapper"
                      ref={el => dropdownRefs.current[field] = el}
                    >
                      <motion.div 
                        className="suggestions-dropdown"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        {suggestions[field].map((suggestion, idx) => (
                          <motion.div
                            key={idx}
                            className="suggestion-item"
                            whileHover={{ backgroundColor: '#f8f9fa' }}
                            onClick={() => handleSelect(field, suggestion)}
                          >
                            <div className="suggestion-address">{suggestion.name}</div>
                            <div className="suggestion-coords">
                              {suggestion.lat.toFixed(4)}, {suggestion.lng.toFixed(4)}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  )}
                </div>
              ))}

              <div className="form-actions">
                <motion.button
                  type="submit"
                  className={`btn-submit ${loading ? 'loading' : ''}`}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                >
                  {loading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
                      <span>{isEditing ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faSave} className="me-2" />
                      <span>{isEditing ? 'Update Trip' : 'Create Trip'}</span>
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          ) : (
            <div className="map-input-container" ref={mapContainerRef}>
              <div className="map-instructions">
                <p>
                  {selectedField 
                    ? `Click on the map to select ${selectedField.replace('_', ' ')} location`
                    : "Select a location field from the form to set via map"}
                </p>
                {selectedField && (
                  <div className="map-coordinates">
                    {mapPosition ? (
                      <>
                        <p>Latitude: {mapPosition.lat.toFixed(6)}</p>
                        <p>Longitude: {mapPosition.lng.toFixed(6)}</p>
                      </>
                    ) : (
                      <p>Click on the map to select a location</p>
                    )}
                  </div>
                )}
              </div>

              <div className="map-wrapper" style={{ height: mapHeight }}>
                <MapContainer 
                  center={[40.7128, -74.0060]} 
                  zoom={8} 
                  style={{ height: '100%', width: '100%', borderRadius: '8px' }}
                > 
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {selectedField && (
                    <LocationMarker 
                      position={mapPosition} 
                      setPosition={setMapPosition} 
                    />
                  )}
                </MapContainer>
              </div>

              <div className="map-actions">
                <button
                  className="btn btn-cancel"
                  onClick={() => {
                    setInputMethod('form');
                    setSelectedField(null);
                    setMapPosition(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-confirm-location"
                  onClick={confirmMapLocation}
                  disabled={!mapPosition || !selectedField}
                >
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
                  Confirm Location
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AddEditTrip;