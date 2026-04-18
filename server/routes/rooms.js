const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const requireAuth = require('../middleware/auth');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Task = require('../models/Task');
const Note = require('../models/Note');
const { getAccessibleRoom } = require('../utils/access');

const router = express.Router();

async function generateInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const exists = await Room.findOne({ inviteCode: code });
    if (!exists) {
      return code;
    }
  }

  throw new Error('Unable to generate invite code.');
}

function roomSummary(room) {
  return {
    id: room._id.toString(),
    name: room.name,
    inviteCode: room.inviteCode,
    owner: room.owner,
    members: room.members,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

function formatMessage(message) {
  return {
    id: message._id.toString(),
    room: message.room.toString(),
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
}

function formatTask(task) {
  return {
    id: task._id.toString(),
    room: task.room.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    order: task.order,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function formatNote(note) {
  return {
    id: note._id.toString(),
    room: note.room.toString(),
    title: note.title,
    content: note.content,
    createdBy: note.createdBy,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

async function emitRoomsUpdated(io, userIds = []) {
  if (!io) return;

  io.emit('rooms:updated', {
    userIds: userIds.map((id) => id.toString())
  });
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id })
      .sort({ updatedAt: -1 })
      .populate('owner', 'username')
      .populate('members', 'username');

    res.json({ rooms: rooms.map(roomSummary) });
  } catch (error) {
    res.status(500).json({ message: 'Could not load rooms.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Room name is required.' });
    }

    const inviteCode = await generateInviteCode();
    const room = await Room.create({
      name,
      inviteCode,
      owner: req.user._id,
      members: [req.user._id]
    });

    await room.populate('owner', 'username');
    await room.populate('members', 'username');

    res.status(201).json({ room: roomSummary(room) });
  } catch (error) {
    res.status(500).json({ message: 'Could not create room.' });
  }
});

router.post('/join', async (req, res) => {
  try {
    const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code is required.' });
    }

    const room = await Room.findOne({ inviteCode });
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    if (!room.members.some((memberId) => memberId.toString() === req.user._id.toString())) {
      room.members.push(req.user._id);
      await room.save();
    }

    await room.populate('owner', 'username');
    await room.populate('members', 'username');

    res.json({ room: roomSummary(room) });
  } catch (error) {
    res.status(500).json({ message: 'Could not join room.' });
  }
});

router.patch('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, owner: req.user._id });
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Room name is required.' });
    }

    room.name = name;
    await room.save();
    await room.populate('owner', 'username');
    await room.populate('members', 'username');

    const io = req.app.get('io');
    await emitRoomsUpdated(io, room.members);

    res.json({ room: roomSummary(room) });
  } catch (error) {
    res.status(500).json({ message: 'Could not update room.' });
  }
});

router.delete('/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, owner: req.user._id }).populate(
      'members',
      'username'
    );

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    await Promise.all([
      Message.deleteMany({ room: room._id }),
      Task.deleteMany({ room: room._id }),
      Note.deleteMany({ room: room._id }),
      Room.deleteOne({ _id: room._id })
    ]);

    const io = req.app.get('io');
    await emitRoomsUpdated(io, room.members);

    res.json({ ok: true, roomId: room._id.toString() });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete room.' });
  }
});

router.get('/:roomId/dashboard', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const [messages, tasks, notes] = await Promise.all([
      Message.find({ room: room._id })
        .sort({ createdAt: 1 })
        .limit(50)
        .populate('sender', 'username'),
      Task.find({ room: room._id })
        .sort({ status: 1, order: 1, createdAt: 1 })
        .populate('createdBy', 'username'),
      Note.find({ room: room._id }).sort({ updatedAt: -1 }).populate('createdBy', 'username')
    ]);

    res.json({
      room: roomSummary(room),
      messages: messages.map(formatMessage),
      tasks: tasks.map(formatTask),
      notes: notes.map(formatNote)
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load room dashboard.' });
  }
});

router.get('/:roomId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.roomId)) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const room = await Room.findOne({ _id: req.params.roomId, members: req.user._id })
      .populate('owner', 'username')
      .populate('members', 'username');

    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    res.json({ room: roomSummary(room) });
  } catch (error) {
    res.status(500).json({ message: 'Could not load room.' });
  }
});

module.exports = router;
