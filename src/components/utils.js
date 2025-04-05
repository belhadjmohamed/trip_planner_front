export const formatHours = (hours) => {
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

export const formatTime = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};


export const findIndexByKey = (key,daysLog) => {
  return daysLog.findIndex(entry => entry.hasOwnProperty(key));
}

export const findByKey = (key,daysLog) => {
  return daysLog.find(entry => entry.hasOwnProperty(key));
}