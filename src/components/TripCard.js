import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEye, 
  faEdit, 
  faTrash, 
  faMapMarkerAlt, 
  faBicycle, 
  faCalendarAlt,
  faCheck,
  faTimes,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

const TripCard = ({ trip, index, onEdit, onView, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently added';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Today';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Recently';
    }
  };

  return (
    <motion.div 
      className={`trip-card ${showDeleteConfirm ? 'expanded' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ boxShadow: showDeleteConfirm ? 'none' : '0 10px 20px rgba(0,0,0,0.1)' }}
    >
      <div className="trip-card-content">
        <div className="trip-card-header">
          <div className="trip-number">Trip {index + 1}</div>
          <div className={`status-badge ${trip.completed ? 'completed' : 'active'}`}>
            {trip.completed ? 'Completed' : 'Active'}
          </div>
        </div>
        
        <div className="trip-details">
          <div className="detail-row">
            <div className="detail-icon">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            </div>
            <div>
              <div className="detail-label">From</div>
              <div className="detail-value">{trip.current_location || 'Not specified'}</div>
            </div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            </div>
            <div>
              <div className="detail-label">To</div>
              <div className="detail-value">{trip.dropoff_location || 'Not specified'}</div>
            </div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon">
              <FontAwesomeIcon icon={faBicycle} />
            </div>
            <div>
              <div className="detail-label">Cycle</div>
              <div className="detail-value">{trip.cycle_used || 'Not specified'}</div>
            </div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div>
              <div className="detail-label">Created</div>
              <div className="detail-value">{formatDate(trip.created_at)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="trip-card-actions">
        <AnimatePresence>
          {showDeleteConfirm ? (
            <motion.div
              className="delete-confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="delete-warning">
                <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                <span>Delete this trip?</span>
              </div>
              <div className="confirm-buttons">
                <motion.button
                  className="confirm-btn"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onDelete();
                    setShowDeleteConfirm(false);
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} />
                </motion.button>
                <motion.button
                  className="cancel-btn"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <>
              <motion.button
                className="btn-action view-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onView}
              >
                <FontAwesomeIcon icon={faEye} />
                <span>View</span>
              </motion.button>
              
              <motion.button
                className="btn-action edit-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onEdit}
              >
                <FontAwesomeIcon icon={faEdit} />
                <span>Edit</span>
              </motion.button>
              
              <motion.button
                className="btn-action delete-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <FontAwesomeIcon icon={faTrash} />
                <span>Delete</span>
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TripCard;
