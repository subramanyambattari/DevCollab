require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const taskRoutes = require('./routes/tasks');
const noteRoutes = require('./routes/notes');
const { getAccessibleRoom } = require('./utils/access');

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 5000);
const clientUrl = process.env.CLIENT_URL;
const staticDir = path.join(__dirname, '..', 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(staticDir, 'index.html'));

app.use(cors({
  origin: clientUrl || true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'devcollab' });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:roomId/messages', messageRoutes);
app.use('/api/rooms/:roomId/tasks', taskRoutes);
app.use('/api/rooms/:roomId/notes', noteRoutes);

if (hasClientBuild) {
  app.use(express.static(staticDir));
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  if (hasClientBuild) {
    return res.sendFile(path.join(staticDir, 'index.html'));
  }

  return res.status(404).json({ message: 'Frontend build not found.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Server error.' });
});

const io = new Server(server, {
  cors: {
    origin: clientUrl || true,
    credentials: true
  }
});

app.set('io', io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required.'));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devcollab-secret');
    socket.user = {
      id: payload.id,
      username: payload.username
    };
    return next();
  } catch (error) {
    return next(new Error('Authentication failed.'));
  }
});

io.on('connection', (socket) => {
  socket.on('room:join', async ({ roomId }) => {
    const room = await getAccessibleRoom(roomId, socket.user.id);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found.' });
      return;
    }

    socket.join(room._id.toString());
    socket.emit('room:joined', {
      roomId: room._id.toString(),
      inviteCode: room.inviteCode
    });
  });

  socket.on('message:send', async ({ roomId, text }) => {
    const room = await getAccessibleRoom(roomId, socket.user.id);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found.' });
      return;
    }

    const messageText = String(text || '').trim();
    if (!messageText) {
      return;
    }

    const user = await User.findById(socket.user.id).select('username');
    const message = await Message.create({
      room: room._id,
      sender: user._id,
      text: messageText
    });
    await message.populate('sender', 'username');

    io.to(room._id.toString()).emit('message:new', {
      id: message._id.toString(),
      room: room._id.toString(),
      sender: {
        id: user._id.toString(),
        username: user.username
      },
      text: message.text,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    });
  });
});

async function start() {
  try {
    await connectDB();
    server.listen(port, () => {
      console.log(`DevCollab server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start DevCollab server.');
    console.error(error);
    process.exit(1);
  }
}

start();
