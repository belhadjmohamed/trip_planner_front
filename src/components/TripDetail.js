import React from 'react';
import { useParams } from 'react-router-dom';
import Map from './Map';
import DailyLogGenerator from './dailyLog';
import './TripDetail.css'; // Import your CSS file

const TripDetail = ({ trips }) => {
    const { id } = useParams();
    const trip = trips ? trips.find(trip => trip.id === parseInt(id)) : null;

    if (!trip) {
        return <div>Trip not found</div>;
    }

    return (
        <div className="trip-detail-container">
            <h2 className="text-center">Trip Details</h2>
            <Map trip={trip} />
            <DailyLogGenerator trip={trip} />
        </div>
    );
};

export default TripDetail;