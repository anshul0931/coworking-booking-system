// Email/notification stub - swap with nodemailer/SES in production.
module.exports = function notify(to, subject, message) {
  if (!to) return;
  console.log(`[NOTIFY] to=${to} | ${subject} | ${message}`);
};
