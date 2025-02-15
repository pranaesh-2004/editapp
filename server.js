const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');



// Express App Initialization
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection for Express
mongoose.connect("mongodb+srv://pranaesh19:pra2004@cluster0.bxx43.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('Error connecting to MongoDB:', err));

// Models
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}));

const bookingSchema = new mongoose.Schema({
  locationName: { type: String, required: true },
  bookedBy: { type: String, required: true },
  timing: { type: String, required: true },
  permissionDetails: { type: String, required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', bookingSchema);

const videoSchema = new mongoose.Schema({
  videoName: { type: String, required: true },
  mergedDate: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema);



const EventRegistrationSchema = new mongoose.Schema({
  eventName: String,
  name: String,
  email: String,
  phone: String
});

const EventRegistration = mongoose.model('EventRegistration', EventRegistrationSchema);

// User Registration
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already in use' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id }, 'your_jwt_secret_key', { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Booking a Location
app.post('/book', async (req, res) => {
  const { locationName, bookedBy, timing, permissionDetails, amount } = req.body;
  if (!locationName || !bookedBy || !timing || !permissionDetails || !amount) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const newBooking = new Booking({ locationName, bookedBy, timing, permissionDetails, amount });
    await newBooking.save();
    res.status(201).json({ message: 'Booking successful', booking: newBooking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Bookings
app.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Merged Video
app.post('/api/videos', async (req, res) => {
  const { videoName } = req.body;
  try {
    const newVideo = new Video({ videoName });
    await newVideo.save();
    res.status(201).json({ message: 'Video saved successfully', video: newVideo });
  } catch (error) {
    console.error('Error saving video:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Merged Videos
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find();
    res.status(200).json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
app.post('/event-register', async (req, res) => {
  try {
      const newRegistration = new EventRegistration(req.body);
      await newRegistration.save();
      res.json({ message: 'Registration Successful!' });
  } catch (error) {
      res.status(500).json({ message: 'Error Registering!' });
  }
});
app.get('/event-registrations', async (req, res) => {
  try {
      const registrations = await EventRegistration.find();
      res.json(registrations);
  } catch (error) {
      res.status(500).json({ message: 'Error fetching registrations!' });
  }
});


// WebSocket and MongoDB Integration for Comments
const uri = "mongodb+srv://pranaesh19:pra2004@cluster0.bxx43.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function main() {
  await client.connect();
  console.log("Connected to MongoDB for WebSocket");
  const db = client.db('collaborationApp');
  const commentsCollection = db.collection('comments');

  const server = new WebSocket.Server({ port: 8080 });
  let clients = [];

  server.on('connection', (ws) => {
    console.log('New client connected');
    clients.push(ws);

    commentsCollection.find().toArray((err, comments) => {
      if (!err) {
        ws.send(JSON.stringify({ type: 'initialComments', content: comments }));
      }
    });

    ws.on('message', async (message) => {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === 'comment') {
        const newComment = { text: parsedMessage.content, timestamp: new Date() };
        await commentsCollection.insertOne(newComment);
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'comment', content: newComment }));
          }
        });
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      clients = clients.filter(client => client !== ws);
    });
  });

  console.log('WebSocket server is running on ws://localhost:8080');
}

main().catch(console.error);

// Start Express Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
