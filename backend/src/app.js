const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');
const swaggerDoc = require('./swagger.json');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok', time: new Date() } }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/spaces', require('./routes/spaces'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use(notFound);
app.use(errorHandler);
module.exports = app;
