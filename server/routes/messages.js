const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const requireAuth = require('../middleware/auth');
const { getAccessibleRoom } = require('../utils/access');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

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

router.get('/', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const messages = await Message.find({ room: room._id })
      .sort({ createdAt: 1 })
      .populate('sender', 'username');

    res.json({ messages: messages.map(formatMessage) });
  } catch (error) {
    res.status(500).json({ message: 'Could not load messages.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const text = String(req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Message text is required.' });
    }

    const message = await Message.create({
      room: room._id,
      sender: req.user._id,
      text
    });

    await message.populate('sender', 'username');

    const io = req.app.get('io');
    if (io) {
      io.to(room._id.toString()).emit('message:new', formatMessage(message));
    }

    res.status(201).json({ message: formatMessage(message) });
  } catch (error) {
    res.status(500).json({ message: 'Could not send message.' });
  }
});

module.exports = router;
