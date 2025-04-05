import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
const templateImage = process.env.PUBLIC_URL + '/driver-log-template.png';

// Status configuration for the grid
// const HOURS_IN_DAY = 24;
// const MAX_HOUR = 24;
// const GRID_COLUMNS = HOURS_IN_DAY;

// Define a color palette for different status types
const COLOR_PALETTE = {
  'OFF': ['#FF6B6B', '#FA5252', '#F03E3E', '#E03131'],  // Red shades
  'SB': ['#4C6EF5', '#4263EB', '#3B5BDB', '#364FC7'],   // Blue shades
  'D': ['#51CF66', '#40C057', '#37B24D', '#2F9E44'],    // Green shades
  'ON': ['#FFA94D', '#FF922B', '#FD7E14', '#F76707']    // Orange shades
};

const STATUS_CONFIG = {
  'OFF': { label: 'Off Duty', gridRow: 1, colors: COLOR_PALETTE.OFF },
  'SB': { label: 'Sleeper Berth', gridRow: 2, colors: COLOR_PALETTE.SB },
  'D': { label: 'Driving', gridRow: 3, colors: COLOR_PALETTE.D },
  'ON': { label: 'On Duty (Not Driving)', gridRow: 4, colors: COLOR_PALETTE.ON }
};

const STATUS_MAPPING = {
  'duty-off': 'OFF',
  'duty-on': 'ON',
  'driving1': 'D',
  'driving2': 'D',
  'duty-off-mid': 'OFF',
  'duty-off-end': 'OFF',
  'sleeping': 'SB',
  'duty-on-fuel1': 'ON',
  'duty-on-fuel2': 'ON',
  'driving-fuel1': 'D',
  'driving-fuel2': 'D',
  'pick-up2': 'ON',
  'driving-pick-up2': 'D',
  'pick-up1': 'ON',
  'driving-pick-up1': 'D',
  'drop-off': 'ON',
  'mandatory-rest': 'OFF'
};

// Helper function to get random color from status colors
const getRandomColor = (status) => {
  const colors = STATUS_CONFIG[status].colors;
  return colors[Math.floor(Math.random() * colors.length)];
};

const DailyLogGenerator = ({ trip }) => {
  const [dailyLogs, setDailyLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // const [templateLoaded, setTemplateLoaded] = useState(false);
  console.log(trip.dropoff_location)

  useEffect(() => {
    const processLogs = async () => {
      try {
        setIsLoading(true);
        if (trip?.daysArray && Array.isArray(trip.daysArray)) {
          const logs = trip.daysArray.map((dayArray, dayIndex) => {
            if (!dayArray || !Array.isArray(dayArray)) return null;

            let currentTime = 0;
            const segments = dayArray.slice(1).filter(item => item).map(item => {
              const key = Object.keys(item)[0];
              const hours = item[key] || 0;
              const status = STATUS_MAPPING[key] || 'OFF';
              const startTime = currentTime;
              currentTime += hours;
              
              // For non-sleeping activities, cap at 23 hours
              const maxHour = status === 'SB' ? 24 : 23;
              
              return {
                status,
                label: STATUS_CONFIG[status].label,
                gridRow: STATUS_CONFIG[status].gridRow,
                startHour: Math.min(startTime, maxHour),
                duration: currentTime > maxHour ? Math.max(0, maxHour - startTime) : hours,
                endHour: Math.min(currentTime, maxHour),
                color: getRandomColor(status),
                eventType: key
              };
            });

            // Calculate total hours per status for the day
            const statusTotals = {
              'OFF': 0,
              'SB': 0,
              'D': 0,
              'ON': 0
            };

            segments.forEach(segment => {
              if (segment && segment.status) {
                statusTotals[segment.status] += segment.duration;
              }
            });

            // Filter out any null segments
            const validSegments = segments.filter(Boolean);

            // Add sleeping berth time if there's a gap at the end of the day
            const lastSegment = validSegments[validSegments.length - 1];
            if (lastSegment && lastSegment.endHour < 24) {
              validSegments.push({
                status: 'SB',
                label: STATUS_CONFIG['SB'].label,
                gridRow: STATUS_CONFIG['SB'].gridRow,
                startHour: lastSegment.endHour,
                duration: 24 - lastSegment.endHour,
                endHour: 24,
                color: getRandomColor('SB'),
                eventType: 'sleeping'
              });
            }

            // Generate remarks
            const remarks = validSegments.reduce((acc, segment, index) => {
              if (!segment) return acc;
              
              const time = `${Math.floor(segment.startHour)}:${String(Math.floor((segment.startHour % 1) * 60)).padStart(2, '0')}`;
              
              // Check for driving time of 0 only if next day has duty-off of 34 hours
              if (segment.eventType?.includes('driving') && segment.duration === 0) {
                // Check if next day exists and has duty-off of 34 hours
                const nextDay = trip.daysArray[dayIndex + 1];
                if (nextDay && nextDay.some(item => {
                  const key = Object.keys(item)[0];
                  return key === 'duty-off' && item[key] === 34;
                })) {
                  acc.push(`No driving time recorded at ${time}`);
                  acc.push(`*** 34-HOUR REST PERIOD REQUIRED ***`);
                }
              }
              
              // Check for mandatory rest
              if (segment.eventType === 'mandatory-rest') {
                acc.push(`Mandatory rest started at ${time}`);
                acc.push(`*** 34-HOUR REST PERIOD REQUIRED ***`);
              }
              
              // Check for duty-off with 34 hours
              if (segment.eventType === 'duty-off' && segment.duration === 34) {
                acc.push(`34-hour mandatory rest period started at ${time}`);
                acc.push(`*** 34-HOUR REST PERIOD REQUIRED ***`);
              }

              // Regular event remarks
              if (segment.eventType?.includes('duty-on-fuel')) {
                acc.push(`Fuel Stop at ${time}`);
              }
              if ((segment.eventType?.includes('pick-up')) && !(segment.eventType?.includes('driving'))) {
                acc.push(`Pick up at ${time}`);
              }
              if (segment.eventType === 'drop-off') {
                acc.push(`Drop off at ${time}`);
              }
              
              return acc;
            }, []);

            return {
              day: dayIndex + 1,
              date: new Date(Date.now() + (dayIndex * 24 * 60 * 60 * 1000)).toLocaleDateString(),
              segments: validSegments,
              statusTotals,
              totalMiles: Math.round((trip.total_distance || 0) / (trip.daysArray?.length || 1)),
              from : trip.current_location,
              to : trip.dropoff_location,
              remarks
            };
          }).filter(Boolean); // Filter out any null logs

          setDailyLogs(logs);
        } else {
          setDailyLogs([]);
        }
      } catch (error) {
        console.error('Error processing logs:', error);
        setDailyLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    processLogs();
  }, [trip]);

  const generatePDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Template dimensions and positions
      const TEMPLATE_WIDTH = 215.9;  // 8.5 inches in mm
      const TEMPLATE_HEIGHT = 279.4; // 11 inches in mm
      const GRID_START_X = 27;       // Grid start position from left
      const GRID_START_Y = 97.5;       // Grid start position from top
      const GRID_WIDTH = 165;        // Grid width
      const GRID_HEIGHT = 40;        // Grid height
      const HOUR_WIDTH = GRID_WIDTH / 24;
      const ROW_HEIGHT = GRID_HEIGHT / 4;

      // Load template image
      const img = new Image();
      img.src = templateImage;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      dailyLogs.forEach((log, pageIndex) => {
        if (pageIndex > 0) {
          doc.addPage();
        }

        // Add template image
        doc.addImage(img, 'PNG', 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);

        // Add header information
        doc.setFontSize(10);
        doc.setTextColor('#0000FF');
        doc.text(log.date.split('/')[1], 77, 9);
        doc.text(log.date.split('/')[0], 95, 9); 
        doc.text(log.date.split('/')[2], 111, 9);
        doc.text(String(log.totalMiles || 0) + 'km', 37, 43); 
        const maxWidthChars = 40; // Adjust based on your column width
        const fromText = String(log.from);
        const toText = String(log.to);

        // Truncate and add '...' if text exceeds maxWidthChars
        const truncate = (text, max) => {
          return text.length > max ? text.substring(0, max) + '...' : text;
        };

        doc.text(truncate(fromText, maxWidthChars), 38, 24);
        doc.text(truncate(toText, maxWidthChars), 115, 24); 
        doc.text(log.statusTotals.OFF.toFixed(1) + 'h', 198, 105);
        doc.text(log.statusTotals.SB.toFixed(1) + 'h', 198, 115);
        doc.text(log.statusTotals.D.toFixed(1) + 'h', 198, 125);
        doc.text(log.statusTotals.ON.toFixed(1) + 'h', 198, 133);

        if (trip?.carrier_info) {
          doc.text(trip.carrier_info.name || '', 140, 60);    // Carrier name
          doc.text(trip.carrier_info.address || '', 140, 70); // Carrier address
        }

        if (trip?.driver_info) {
          doc.text(trip.driver_info.name || '', 65, 70);      // Driver name
          doc.text(trip.driver_info.license || '', 65, 80);   // Driver license
        }

        // Draw status lines
        log.segments.forEach((segment, i) => {
          const maxHour = segment.status === 'SB' ? 24 : 23;
          const startX = GRID_START_X + (Math.min(segment.startHour, maxHour) * HOUR_WIDTH);
          const endX = GRID_START_X + (Math.min(segment.endHour, maxHour) * HOUR_WIDTH);
          const width = endX - startX;
          const y = GRID_START_Y + ((segment.gridRow - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);

          if (width > 0) {
            // Set line color
            doc.setDrawColor(segment.color);
            doc.setLineWidth(0.5);

            // Draw horizontal line
            doc.line(startX, y, startX + width, y);

            // Draw vertical line to previous segment if needed
            if (i > 0 && segment.duration > 0 && log.segments[i-1].duration > 0) {
              const prevSegment = log.segments[i-1];
              const prevY = GRID_START_Y + ((prevSegment.gridRow - 1) * ROW_HEIGHT) + (ROW_HEIGHT / 2);
              
              // Draw vertical line with gradient effect
              const steps = 10;
              const heightStep = (y - prevY) / steps;
              
              for (let step = 0; step < steps; step++) {
                doc.setDrawColor(segment.color);
                doc.line(
                  startX,
                  prevY + (step * heightStep),
                  startX,
                  prevY + ((step + 1) * heightStep)
                );
              }
            }
          }
        });

        // Add remarks
        doc.setDrawColor(0);
        doc.setFontSize(9);
        let remarkY = 160; // Starting Y position for remarks
        
        // Add shipping documents
        if (trip?.shipping_docs) {
          doc.text('Shipping Documents:', GRID_START_X, remarkY);
          remarkY += 5;
          trip.shipping_docs.forEach(doc => {
            doc.text(`- ${doc}`, GRID_START_X + 5, remarkY);
            remarkY += 4;
          });
          remarkY += 5;
        }

        // Add remarks
        if (log.remarks && log.remarks.length > 0) {
          doc.text('Remarks:', GRID_START_X, remarkY);
          remarkY += 5;
          log.remarks.forEach(remark => {
            doc.text(remark, GRID_START_X + 5, remarkY);
            remarkY += 4;
          });
        }
      });

      // Save the PDF
      doc.save(`driver_log_${trip?.current_location || 'trip'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('There was an error generating the PDF. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="alert alert-info">Loading daily logs...</div>;
  }

  return (
    <div className="card p-3 mb-4">
      <h3 className="mb-3">Driver's Daily Log</h3>
      
      {dailyLogs && dailyLogs.length > 0 ? (
        <div>
          <button 
            onClick={generatePDF} 
            className="btn btn-primary"
          >
            Download Daily Log
          </button>

          <div className="mt-3">
            <h5>Preview:</h5>
            {dailyLogs.map((log, dayIdx) => {
              if (!log || !log.segments) return null;
              
              return (
                <div key={dayIdx} className="mb-3 p-3 border rounded">
                  <h6>Day {log.day} - {log.date}</h6>
                  <div className="grid-preview" style={{ 
                    position: 'relative',
                    height: '160px',
                    border: '1px solid #000',
                    marginTop: '20px',
                    marginLeft: '120px',
                    overflow: 'visible'
                  }}>
                    {/* Status labels */}
                    <div style={{ 
                      position: 'absolute', 
                      left: '-120px', 
                      top: 0, 
                      height: '100%',
                      width: '100px',
                      textAlign: 'right',
                      paddingRight: '10px',
                      zIndex: 3
                    }}>
                      {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                        <div key={status} style={{
                          position: 'absolute',
                          top: `${(config.gridRow - 1) * 40 + 10}px`,
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: config.colors[0],
                          whiteSpace: 'nowrap'
                        }}>
                          {config.label}
                        </div>
                      ))}
                    </div>

                    {/* Grid background */}
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={`row-${i}`} style={{
                        position: 'absolute',
                        top: `${i * 40}px`,
                        width: '100%',
                        height: '40px',
                        borderBottom: '1px solid #000'
                      }}>
                        {Array.from({ length: 24 }).map((_, j) => (
                          <div key={`col-${j}`} style={{
                            position: 'absolute',
                            left: `${(j / 24) * 100}%`,
                            width: `${100/24}%`,
                            height: '100%',
                            borderRight: '1px solid #ccc'
                          }}>
                            <span style={{
                              position: 'absolute',
                              bottom: '-20px',
                              fontSize: '10px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 3
                            }}>{j}</span>
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Add x-axis label */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-30px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#666',
                      zIndex: 3
                    }}>
                      Time (Hours)
                    </div>

                    {/* Status lines */}
                    {log.segments.map((segment, i) => {
                      if (!segment) return null;

                      // For preview, allow sleeping berth to reach hour 24
                      const maxHour = segment.status === 'SB' ? 24 : 23;
                      const startHour = Math.min(segment.startHour || 0, maxHour);
                      const endHour = Math.min(segment.endHour || 0, maxHour);
                      const startX = (startHour / 24) * 100;
                      const width = ((endHour - startHour) / 24) * 100;
                      const y = ((segment.gridRow || 1) - 1) * 40;

                      if (width > 0) {
                        return (
                          <React.Fragment key={i}>
                            {/* Horizontal line */}
                            <div style={{
                              position: 'absolute',
                              left: `${startX}%`,
                              top: `${y + 20}px`,
                              width: `${width}%`,
                              height: '2px',
                              backgroundColor: segment.color || '#000',
                              zIndex: 2
                            }} />
                            
                            {/* Vertical line to previous segment */}
                            {i > 0 && segment.duration > 0 && log.segments[i-1]?.duration > 0 && (
                              <div style={{
                                position: 'absolute',
                                left: `${startX}%`,
                                top: `${Math.min(y + 20, ((log.segments[i-1]?.gridRow || 1) - 1) * 40 + 20)}px`,
                                width: '2px',
                                height: `${Math.abs(y - ((log.segments[i-1]?.gridRow || 1) - 1) * 40)}px`,
                                background: `linear-gradient(to bottom, ${log.segments[i-1]?.color || '#000'}, ${segment.color || '#000'})`,
                                zIndex: 2
                              }} />
                            )}
                          </React.Fragment>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Remarks section */}
                  {log.remarks && log.remarks.length > 0 && (
                    <div className="mt-3">
                      <h6>Remarks:</h6>
                      <ul className="list-unstyled">
                        {log.remarks.map((remark, idx) => (
                          <li key={idx} className="small text-muted">{remark}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          {trip ? 'No log data available' : 'Submit trip details to generate logs'}
        </div>
      )}
    </div>
  );
};

export default DailyLogGenerator;