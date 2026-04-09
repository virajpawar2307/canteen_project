const DEFAULT_UTC_OFFSET_MINUTES = 330;

const getAppUtcOffsetMinutes = () => {
  const value = Number(process.env.APP_UTC_OFFSET_MINUTES);
  return Number.isFinite(value) ? value : DEFAULT_UTC_OFFSET_MINUTES;
};

const shiftToAppOffset = (input) => {
  const date = input instanceof Date ? input : new Date(input);
  return new Date(date.getTime() + getAppUtcOffsetMinutes() * 60 * 1000);
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateInAppOffset = (input) => {
  const shifted = shiftToAppOffset(input);
  const year = shifted.getUTCFullYear();
  const month = pad2(shifted.getUTCMonth() + 1);
  const day = pad2(shifted.getUTCDate());
  return `${year}-${month}-${day}`;
};

const formatTimeInAppOffset = (input) => {
  const shifted = shiftToAppOffset(input);
  const hours24 = shifted.getUTCHours();
  const minutes = pad2(shifted.getUTCMinutes());
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${pad2(hours12)}:${minutes} ${meridiem}`;
};

const getCurrentMinutesInAppOffset = () => {
  const shifted = shiftToAppOffset(new Date());
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

const parseDateBoundsInAppOffset = (startDate, endDate) => {
  const [startYear, startMonth, startDay] = String(startDate).split('-').map(Number);
  const [endYear, endMonth, endDay] = String(endDate).split('-').map(Number);
  const offsetMs = getAppUtcOffsetMinutes() * 60 * 1000;

  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) - offsetMs);
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) - offsetMs);

  return { start, end };
};

module.exports = {
  formatDateInAppOffset,
  formatTimeInAppOffset,
  getCurrentMinutesInAppOffset,
  parseDateBoundsInAppOffset,
};