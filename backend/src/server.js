require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT} (docs: /api/docs)`));
  } catch (e) {
    console.error('Startup failed:', e.message);
    process.exit(1);
  }
})();
