import React, { useEffect, useRef,useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet-routing-machine';
import '../styles/MapComponent.css'; // Import the CSS file
import { findIndexByKey,findByKey } from './utils';


// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const fuelIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/128/465/465039.png', 
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const restIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/128/2027/2027445.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const maxDriveLimitIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/128/1422/1422872.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const dayEndIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/128/3652/3652191.png', // Sunset icon for end of day
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});



const Map = ({ trip,onRouteCalculated  }) => {

  const formatHours = (hours) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  const toggleRouteInfo = () => {
    setRouteInfoVisible(!routeInfoVisible);
    const container = document.getElementById('custom-route-container');
    if (container) {
      container.style.display = routeInfoVisible ? 'none' : 'block';
    }
  };

  // Add these state variables at the top of your Map component
  const [routeInfo, setRouteInfo] = useState({
    totalDistance: 0,
    estimatedTime: 0,
    fuelStops: 0,
    restStops: 0,
    weeklyLimitReached: false,
    mandatoryRest: false
  });

  const [routeInfoVisible, setRouteInfoVisible] = useState(true);

  const routeControlRef = useRef(null);
  const mapRef = useRef(null);
  const fuelMarkersRef = useRef([]);
  const restMarkersRef = useRef([]);
  const maxDriveMarkerRef = useRef(null);
  const dayEndMarkersRef = useRef([]);

  const positions = [
    trip.current_lat && trip.current_lng ? [trip.current_lat, trip.current_lng] : null,
    trip.pickup_lat && trip.pickup_lng ? [trip.pickup_lat, trip.pickup_lng] : null,
    trip.dropoff_lat && trip.dropoff_lng ? [trip.dropoff_lat, trip.dropoff_lng] : null
  ].filter(Boolean);

  const Routing = () => {
    const map = useMap();
    mapRef.current = map;
  
    useEffect(() => {
      if (!positions.length || positions.length < 2 || !mapRef.current) return;
  
      // Clean up function to handle control and marker removal
      const cleanup = () => {
        if (routeControlRef.current && mapRef.current) {
          try {
            routeControlRef.current.getPlan().setWaypoints([]);
            mapRef.current.removeControl(routeControlRef.current);
            routeControlRef.current = null;
          } catch (err) {
            console.warn('Cleanup warning:', err);
          }
        }
  
        // Clean up markers
        if (mapRef.current) {
          fuelMarkersRef.current.forEach(marker => {
            if (marker && mapRef.current.hasLayer(marker)) {
              mapRef.current.removeLayer(marker);
            }
          });
          fuelMarkersRef.current = [];
          
          restMarkersRef.current.forEach(marker => {
            if (marker && mapRef.current.hasLayer(marker)) {
              mapRef.current.removeLayer(marker);
            }
          });
          restMarkersRef.current = [];
          
          if (maxDriveMarkerRef.current && mapRef.current.hasLayer(maxDriveMarkerRef.current)) {
            mapRef.current.removeLayer(maxDriveMarkerRef.current);
            maxDriveMarkerRef.current = null;
          }
      
          dayEndMarkersRef.current.forEach(marker => {
            if (marker && mapRef.current.hasLayer(marker)) {
              mapRef.current.removeLayer(marker);
            }
          });
          dayEndMarkersRef.current = [];
        }
      };

      // Clean up before setting up new route
      cleanup();
  
      // Create new routing control
      routeControlRef.current = L.Routing.control({
        waypoints: positions.map(pos => L.latLng(pos)),
        routeWhileDragging: false,
        show: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        createMarker: () => null,
        lineOptions: {
          styles: [{ color: '#3a7bd5', weight: 5 }]
        },
      });
  
      const onRouteFound = (e) => {
        const routes = e.routes;
        if (routes?.length) {
          const distance = routes[0].summary.totalDistance / 1000;
          const time = routes[0].summary.totalTime / 60;

          let fuelStopCount = 0;
          let restStopCount = 0;
          let weeklyLimitHit = false;
      
          // Calculate remaining drive time before mandatory rest
          const cycleUsed = trip.cycle_used || 0;
          const remainingHours = 70 - cycleUsed;
          const remainingMinutes = remainingHours * 60;
      
          // Calculate average speed (km/h)
          const avgSpeed = distance / (time / 60);
      
          // Extract route path points
          const coordinates = routes[0].coordinates;
          let cumulativeDistance = 0;
          let cumulativeTime = 0;
          let lastRestStop = 0;
          let lastFuelStop = 0;
          
          // Track daily driving time
          let currentDay = 1;
          let dailyDrivingTime = 0;
          const maxDailyDrivingTime = 9 * 60; // 9 hours in minutes
      
          // Track if weekly limit was reached
          let weeklyLimitReached = false;
          let weeklyLimitPosition = null;

          const daysArray = [[
            {'day-position' : L.latLng(coordinates[0])},
            {'duty-off' : 6},
            {'duty-on' : 0.5},
            {'driving1' : 0},
            {'duty-off-mid' : 0.5},
            {'driving2' : 0},
            {'duty-off-end' : 2},
            {'sleeping' : 6}
          ]]


          let firstSegmentDrive = false
          let secondSegmentDrive = false
          let isFuelStopActive1 = false
          let isFuelStopActive2 = false
          let isPickUpStopActive1 = false
          let isPickUpStopActive2 = false


          for (let i = 1; i < coordinates.length; i++) {
            const prev = L.latLng(coordinates[i - 1]);
            const curr = L.latLng(coordinates[i]);
            const segmentDistance = prev.distanceTo(curr) / 1000;
            cumulativeDistance += segmentDistance;
            
            const segmentTime = (segmentDistance / avgSpeed) * 60;
            cumulativeTime += segmentTime;
            dailyDrivingTime += segmentTime;
            const currentDayIndex = currentDay - 1;

            // Update driving time in the current day's schedule

            const driving1 =  daysArray[currentDayIndex][findIndexByKey("driving1",daysArray[currentDayIndex])]['driving1']
            const drivingFuel1 = findIndexByKey("driving-fuel1",daysArray[currentDayIndex]) === -1 ? 0 : daysArray[currentDayIndex][findIndexByKey("driving-fuel1",daysArray[currentDayIndex])]['driving-fuel1']
            const driving2 =  daysArray[currentDayIndex][findIndexByKey("driving2",daysArray[currentDayIndex])]['driving2']
            const drivingFuel2 = findIndexByKey("driving-fuel2",daysArray[currentDayIndex]) === -1 ? 0 : daysArray[currentDayIndex][findIndexByKey("driving-fuel2",daysArray[currentDayIndex])]['driving-fuel2']
            const drivingPickUp2 = findIndexByKey("driving-pick-up2",daysArray[currentDayIndex]) === -1 ? 0 : daysArray[currentDayIndex][findIndexByKey("driving-pick-up2",daysArray[currentDayIndex])]['driving-pick-up2']
            const drivingPickUp1 = findIndexByKey("driving-pick-up1",daysArray[currentDayIndex]) === -1 ? 0 : daysArray[currentDayIndex][findIndexByKey("driving-pick-up1",daysArray[currentDayIndex])]['driving-pick-up1']


            if (daysArray[currentDayIndex]) {
              // Update first driving segment (before lunch break)
              if (((driving1 + segmentTime/60) <= 4.5 && !drivingFuel1 && !drivingPickUp1) || (drivingPickUp1 + drivingFuel1 + segmentTime/60  + driving1 <= 4.5) ) {
                firstSegmentDrive = true
                secondSegmentDrive = false
                

                if(!isFuelStopActive1 && !isPickUpStopActive1){
                  daysArray[currentDayIndex][findIndexByKey("driving1",daysArray[currentDayIndex])]['driving1'] += segmentTime/60;
                }else if (isFuelStopActive1 && !isPickUpStopActive1){
                  daysArray[currentDayIndex][findIndexByKey("driving-fuel1",daysArray[currentDayIndex])]['driving-fuel1'] += segmentTime/60;
                  if (((drivingFuel1 + segmentTime / 60 + driving1 + drivingPickUp1) ) >= 4.45 && ((drivingFuel1 + segmentTime / 60) + driving1 + drivingPickUp1) <= 4.5) {
                    isFuelStopActive1 = false;
                  }
                }else if (!isFuelStopActive1 && isPickUpStopActive1) {
                  daysArray[currentDayIndex][findIndexByKey("driving-pick-up1",daysArray[currentDayIndex])]['driving-pick-up1'] += segmentTime/60;
                  if (((drivingFuel1 + segmentTime / 60 + driving1 + drivingPickUp1) ) >= 4.45 && ((drivingFuel1 + segmentTime / 60) + driving1 + drivingPickUp1) <= 4.5) {
                    isPickUpStopActive1 = false;
                  }
                }

              } 
              // Update second driving segment (after lunch break)
              else if ((driving2 + segmentTime/60 <= 4.5 && !drivingFuel2 && !drivingPickUp2) ||  (drivingPickUp2 + drivingFuel2 + segmentTime/60  + driving2 <= 4.5) ) {
                firstSegmentDrive = false
                secondSegmentDrive = true

                
                if(!isFuelStopActive2 && !isPickUpStopActive2){
                  daysArray[currentDayIndex][findIndexByKey("driving2",daysArray[currentDayIndex])]['driving2'] += segmentTime/60;
                }else if (isFuelStopActive2 && !isPickUpStopActive2 ){
                  daysArray[currentDayIndex][findIndexByKey("driving-fuel2",daysArray[currentDayIndex])]['driving-fuel2'] += segmentTime/60;    
                  if (((drivingFuel2 + segmentTime / 60  + driving2 + drivingPickUp2)) >= 4.45 && ((drivingFuel2 + segmentTime / 60  + driving2 + drivingPickUp2)) <= 4.5) {
                    isFuelStopActive2 = false;
                  }
                }else if (!isFuelStopActive2 && isPickUpStopActive2) {

                  daysArray[currentDayIndex][findIndexByKey("driving-pick-up2",daysArray[currentDayIndex])]['driving-pick-up2'] += segmentTime/60;    
                  if (((drivingFuel2 + segmentTime / 60  + driving2 + drivingPickUp2)) >= 4.45 && ((drivingFuel2 + segmentTime / 60  + driving2 + drivingPickUp2)) <= 4.5) {
                    isPickUpStopActive2 = false;
                  }
                }
                
              }
            }
      
            // Check if we've reached the weekly limit (but not already marked)
            if (cumulativeTime >= remainingMinutes && !weeklyLimitReached) {
              weeklyLimitHit = true;
              weeklyLimitReached = true;
              weeklyLimitPosition = curr;
              
              maxDriveMarkerRef.current = L.marker(curr, { icon: maxDriveLimitIcon })
                .bindPopup(`
                  <b>WEEKLY LIMIT REACHED (Day ${currentDay})</b><br>
                  Total driving time: ${(cumulativeTime/60).toFixed(1)} hours<br>
                  Cycle Used: ${cycleUsed} hours<br>
                  Required rest: 34 consecutive hours<br>
                  Driving will resume after mandatory rest period
                `);
              maxDriveMarkerRef.current.addTo(map);



              // Add 34-hour rest period as a special day
              const restDay = [
                {'mandatory-rest-position': curr},
                {'duty-off': 34}, // 34-hour rest period
              ];
              
              daysArray.splice(currentDay, 0, restDay);

              // Add 34 hours to the cumulative time (rest period)
              cumulativeTime += 34 * 60;
              // Reset daily driving time after rest period
              dailyDrivingTime = 0;
              // Increment day count for the rest period
              currentDay += Math.ceil(34 / 24); // Add full days for the rest period
              lastRestStop = cumulativeTime;
              
              // Start new day with fresh schedule
              daysArray.push([
                {'day-position': curr},
                {'duty-off': 6},
                {'duty-on': 0.5},
                {'driving1': 0},
                {'duty-off-mid': 0.5},
                {'driving2': 0},
                {'duty-off-end': 2},
                {'sleeping': 6}
              ]);
              

              
              // Skip adding other markers at this exact position
              continue;
            }
      
            // Check for end of driving day (9 hours)
            if (dailyDrivingTime >= maxDailyDrivingTime && currentDay < 8) {
              const dayEndMarker = L.marker(curr, { icon: dayEndIcon })
                .bindPopup(`
                  <b>END OF DAY ${currentDay}</b><br>
                  Total driving time today: ${(dailyDrivingTime/60).toFixed(1)} hours<br>
                  Required rest: 11 consecutive hours<br>
                  Next driving period starts tomorrow (Day ${currentDay + 1})
                `);
              dayEndMarker.addTo(map);
              dayEndMarkersRef.current.push(dayEndMarker);

              const daysLog = [
                {'day-position' : curr},
                {'duty-off' : 6},
                {'duty-on' : 0.5},
                {'driving1' : 0},
                {'duty-off-mid' : 0.5},
                {'driving2' : 0},
                {'duty-off-end' : 2},
                {'sleeping' : 6}
              ]

              daysArray.push(daysLog)



              console.log(daysArray)
              // Reset for next day
              currentDay++;
              dailyDrivingTime = 0;
              lastRestStop = cumulativeTime;
            }
            
            // Add fuel stops every 1000 km
            if (cumulativeDistance - lastFuelStop >= 1000) {
              fuelStopCount++;
              lastFuelStop = cumulativeDistance;
              const fuelMarker = L.marker(curr, { icon: fuelIcon })
                .bindPopup(`Fuel Rest Stop ⛽<br>Distance: ${cumulativeDistance.toFixed(1)} km<br>Day: ${currentDay}`);
              fuelMarker.addTo(map);
              fuelMarkersRef.current.push(fuelMarker);


              // Track current segment in day's schedule
              if(firstSegmentDrive && !secondSegmentDrive) {
                let currentSegment = findByKey("duty-off-mid",daysArray[currentDayIndex])
                if (currentSegment.hasOwnProperty("duty-off-mid") ) {
                  isFuelStopActive1 = true
                  daysArray[currentDayIndex].splice(findIndexByKey("duty-off-mid", daysArray[currentDayIndex]), 0, { "duty-on-fuel1": 0.5 });
                  daysArray[currentDayIndex].splice(findIndexByKey("duty-on-fuel1", daysArray[currentDayIndex]) + 1, 0, { "driving-fuel1": 0 });
                  daysArray[currentDayIndex][findIndexByKey("sleeping",daysArray[currentDayIndex])]['sleeping'] = 5
                }
              }else if (!firstSegmentDrive && secondSegmentDrive){
                let currentSegment = findByKey("duty-off-end",daysArray[currentDayIndex])
                if (currentSegment.hasOwnProperty("duty-off-end") ) {
                  isFuelStopActive2 = true
                  daysArray[currentDayIndex].splice(findIndexByKey("duty-off-end", daysArray[currentDayIndex]), 0, { "duty-on-fuel2": 0.5 });
                  daysArray[currentDayIndex].splice(findIndexByKey("duty-on-fuel2", daysArray[currentDayIndex]) + 1, 0, { "driving-fuel2": 0 });
                  daysArray[currentDayIndex][findIndexByKey("sleeping",daysArray[currentDayIndex])]['sleeping'] = 5
                }
              }

            }


            // Check if current position is near pickup or dropoff locations
            const isPickup = positions[1] && curr.distanceTo(L.latLng(positions[1])) < 500;
            const isDropoff = positions[2] && curr.distanceTo(L.latLng(positions[2])) < 500;
            
            // Add pickup location to daysArray if we're near it
            if (isPickup && !(daysArray[currentDayIndex].some(item => item.hasOwnProperty('driving-pick-up1') || daysArray[currentDayIndex].some(item => item.hasOwnProperty('driving-pick-up2'))))) {
              // Track current segment in day's schedule
              if(firstSegmentDrive && !secondSegmentDrive) {
                let currentSegment = findByKey("duty-off-mid",daysArray[currentDayIndex])
                if (currentSegment.hasOwnProperty("duty-off-mid") ) {
                  isPickUpStopActive1 = true
                  daysArray[currentDayIndex].splice(findIndexByKey("duty-off-mid", daysArray[currentDayIndex]), 0, { "pick-up1": 1 });
                  daysArray[currentDayIndex].splice(findIndexByKey("pick-up1", daysArray[currentDayIndex]) + 1, 0, { "driving-pick-up1": 0 });
                  daysArray[currentDayIndex][findIndexByKey("duty-off-end",daysArray[currentDayIndex])]['duty-off-end'] = 1
                }
              }else if (!firstSegmentDrive && secondSegmentDrive){
                let currentSegment = findByKey("duty-off-end",daysArray[currentDayIndex])
                if (currentSegment.hasOwnProperty("duty-off-end") ) {
                  isPickUpStopActive2 = true
                  daysArray[currentDayIndex].splice(findIndexByKey("duty-off-end", daysArray[currentDayIndex]), 0, { "pick-up2": 1 });
                  daysArray[currentDayIndex].splice(findIndexByKey("pick-up2", daysArray[currentDayIndex]) + 1, 0, { "driving-pick-up2": 0 });  
                  daysArray[currentDayIndex][findIndexByKey("duty-off-end",daysArray[currentDayIndex])]['duty-off-end'] = 1
                }
              }
            }

            // Add dropoff location to daysArray if we're near it
            if (isDropoff && !daysArray[currentDayIndex].some(item => item.hasOwnProperty('drop-off'))) {
              daysArray[currentDayIndex].splice(findIndexByKey("duty-off-end", daysArray[currentDayIndex]), 0, 
                { "drop-off": 1 }
              );
              daysArray[currentDayIndex][findIndexByKey("duty-off-end",daysArray[currentDayIndex])]['duty-off-end'] = 1
            }
            
            // Add regular rest stops every 4.5 hours of driving
            if (cumulativeTime - lastRestStop >= 270 && 
                (!weeklyLimitPosition || !curr.equals(weeklyLimitPosition))) {
                  restStopCount++;
              const drivingTimeSinceLastBreak = cumulativeTime - lastRestStop;
              lastRestStop = cumulativeTime;
              const restMarker = L.marker(curr, { icon: restIcon })
                .bindPopup(`
                  Regular Rest Stop 🛏️ (Day ${currentDay})<br>
                  Driving time since last break: ${(drivingTimeSinceLastBreak/60).toFixed(1)} hours<br>
                  Required rest: 30 minutes
                `);
              restMarker.addTo(map);
              restMarkersRef.current.push(restMarker);
            }
          }
  
          const newRouteInfo = {
            totalDistance: distance.toFixed(1),
            estimatedTime: time / 60,
            fuelStops: fuelStopCount,
            restStops: restStopCount,
            weeklyLimitReached: weeklyLimitHit,
            mandatoryRest: weeklyLimitHit,
            daysArray : daysArray
          };

          // Only update state if values have actually changed
          setRouteInfo(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newRouteInfo)) {
                // Call the callback function with the new route info
                if (onRouteCalculated) {
                    onRouteCalculated(newRouteInfo);
                }
                return newRouteInfo;
            }
            return prev;
          });
        }
      };
  
      routeControlRef.current.on('routesfound', onRouteFound);
      routeControlRef.current.addTo(map);
  
      // Move the control to our custom container
      const customContainer = document.getElementById('custom-route-container');
      if (customContainer) {
        customContainer.className = 'route-control-container'; // Add our class
        const controlContainer = routeControlRef.current.getContainer();
        // Additional DOM manipulation to clean up the control
        const geocoders = controlContainer.querySelector('.leaflet-routing-geocoders');
        if (geocoders) {
          geocoders.remove();
        }
        customContainer.appendChild(controlContainer);

        // Optionally add a custom close button
        const closeButton = document.createElement('span');
        closeButton.className = 'leaflet-routing-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => {
          customContainer.style.display = 'none';
        };
        controlContainer.appendChild(closeButton);
        // Set initial visibility
        customContainer.style.display = routeInfoVisible ? 'block' : 'none';
      }
  
      return cleanup;
    }, [map, JSON.stringify(positions)]);
  
    return null;
  };

  return (
    <div className="map-container" >
      <div className='map-wrapper' >
      <MapContainer
        className='map-container'
        center={positions[0] || [39.8283, -98.5795]}
        zoom={positions.length ? 12 : 4}
        zoomControl={false} // We'll add custom controls
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {positions.map((pos, idx) => (
          <Marker 
            key={idx} 
            position={pos}
          >
            <Popup>{['Current', 'Pickup', 'Dropoff'][idx]} Location</Popup>
          </Marker>
        ))}
        <Routing />
      </MapContainer>
      
      </div>

      
      <div  className="route-info-panel">
      <div className="route-header">
        <h3 className="route-title">Route Information</h3>
        <div className="button-group">
          <button className="route-button"  onClick={toggleRouteInfo}>
            <i className="fas fa-route"></i> {routeInfoVisible ? 'Hide Route Info' : 'Show Route Info'}
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label"><i className="fas fa-road"></i> Total Distance</div>
          <div className="metric-value">{routeInfo.totalDistance} km</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Estimated Time</div>
          <div className="metric-value">{formatHours(routeInfo.estimatedTime)}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Fuel Stops</div>
          <div className="metric-value">{routeInfo.fuelStops}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Rest Stops</div>
          <div className="metric-value">{routeInfo.restStops}</div>
        </div>
      </div>

      <div className="route-details">
        <div className="detail-item">
          <span>Average Speed:</span>
          <span>{(routeInfo.totalDistance / routeInfo.estimatedTime).toFixed(1)} km/h</span>
        </div>
        <div className="detail-item">
          <span>Driving Days:</span>
          <span>{Math.ceil(routeInfo.estimatedTime / 9)} days</span>
        </div>
      </div>

      {routeInfo.weeklyLimitReached && (
        <div className="alert-card warning">
          <i className="fas fa-exclamation-triangle"></i>
          <div>
            <strong>Weekly Limit Reached</strong>
            <p>Driver must take 34 hours of mandatory rest</p>
          </div>
        </div>
      )}

      <div className="legend-container">
        <h4 className="legend-title">Map Legend</h4>
        
        <div className="legend-grid">
          {/* Default Marker */}
          <div className="legend-item">
            <div className="legend-icon-container">
              <img src={markerIcon} alt="Location" className="legend-icon-img default-marker" />
            </div>
            <span className="legend-text">Current, pickup, dropoff location</span>
          </div>
          
          {/* Fuel Stop */}
          <div className="legend-item">
            <div className="legend-icon-container">
              <img src="https://cdn-icons-png.flaticon.com/128/465/465039.png" alt="Fuel" className="legend-icon-img" />
            </div>
            <span className="legend-text">Fuel Stop</span>
          </div>
          
          {/* Rest Stop */}
          <div className="legend-item">
            <div className="legend-icon-container">
              <img src="https://cdn-icons-png.flaticon.com/128/2027/2027445.png" alt="Rest" className="legend-icon-img" />
            </div>
            <span className="legend-text">Rest Stop</span>
          </div>
          
          {/* Drive Limit */}
          <div className="legend-item">
            <div className="legend-icon-container">
              <img src="https://cdn-icons-png.flaticon.com/128/1422/1422872.png" alt="Limit" className="legend-icon-img" />
            </div>
            <span className="legend-text">Drive Limit</span>
          </div>
          
          {/* End of Day */}
          <div className="legend-item">
            <div className="legend-icon-container">
              <img src="https://cdn-icons-png.flaticon.com/128/3652/3652191.png" alt="Day End" className="legend-icon-img" />
            </div>
            <span className="legend-text">End of Day</span>
          </div>
          
          {/* Route Path */}
          <div className="legend-item">
            <div className="legend-route-line"></div>
            <span className="legend-text">Route Path</span>
          </div>
        </div>
      </div>

      <div id="custom-route-container"></div>

    </div>

  </div>
  );
};

export default Map;