const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Build a Date from "YYYY-MM-DD" + "HH:mm" (server local / UTC consistent)
function toDate(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !HHMM.test(time)) return null;
  const d = new Date(`${date}T${time}:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}
const overlapQuery = (spaceId, startAt, endAt, statuses = ['pending', 'approved']) => ({
  space: spaceId,
  status: { $in: statuses },
  startAt: { $lt: endAt },
  endAt: { $gt: startAt }
});
module.exports = { toDate, overlapQuery, HHMM };
