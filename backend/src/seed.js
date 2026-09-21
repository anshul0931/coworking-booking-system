require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');
const Space = require('./models/Space');
const Booking = require('./models/Booking');

(async () => {
  await connectDB(process.env.MONGO_URI);
  await Promise.all([User.deleteMany({}), Space.deleteMany({}), Booking.deleteMany({})]);
  await User.create({ name: 'Admin', email: 'admin@cowork.com', password: 'admin123', role: 'admin' });
  await User.create({ name: 'Member', email: 'member@cowork.com', password: 'member123', role: 'member' });
  const types = ['desk', 'room'];
  const amen = [['Wifi', 'Power socket'], ['Projector', 'Whiteboard', 'AC'], ['Wifi', 'Monitor'], ['TV', 'Wifi', 'Coffee']];
  const docs = [];
  for (let i = 1; i <= 14; i++) {
    const type = types[i % 2];
    docs.push({
      name: `${type === 'desk' ? 'Hot Desk' : 'Meeting Room'} ${i}`,
      type, capacity: type === 'desk' ? 1 : 4 + (i % 10),
      amenities: amen[i % amen.length],
      description: `Comfortable ${type} on floor ${1 + (i % 3)}.`,
      pricePerHour: type === 'desk' ? 100 : 400
    });
  }
  await Space.insertMany(docs);
  console.log('Seeded. admin@cowork.com/admin123  member@cowork.com/member123');
  process.exit(0);
})();
