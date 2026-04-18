const express = require('express');
const Note = require('../models/Note');
const requireAuth = require('../middleware/auth');
const { getAccessibleRoom } = require('../utils/access');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

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

async function emitNoteUpdate(req, roomId) {
  const io = req.app.get('io');
  if (io) {
    const notes = await Note.find({ room: roomId })
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'username');
    io.to(roomId.toString()).emit('notes:updated', {
      roomId: roomId.toString(),
      notes: notes.map(formatNote)
    });
  }
}

router.get('/', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const notes = await Note.find({ room: room._id })
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'username');
    res.json({ notes: notes.map(formatNote) });
  } catch (error) {
    res.status(500).json({ message: 'Could not load notes.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();

    if (!title || !content) {
      return res.status(400).json({ message: 'Note title and content are required.' });
    }

    const note = await Note.create({
      room: room._id,
      title,
      content,
      createdBy: req.user._id
    });

    await note.populate('createdBy', 'username');
    await emitNoteUpdate(req, room._id);
    res.status(201).json({ note: formatNote(note) });
  } catch (error) {
    res.status(500).json({ message: 'Could not create note.' });
  }
});

router.patch('/:noteId', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const note = await Note.findOne({ _id: req.params.noteId, room: room._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    if (typeof req.body.title === 'string') {
      const title = req.body.title.trim();
      if (!title) {
        return res.status(400).json({ message: 'Note title cannot be empty.' });
      }
      note.title = title;
    }

    if (typeof req.body.content === 'string') {
      const content = req.body.content.trim();
      if (!content) {
        return res.status(400).json({ message: 'Note content cannot be empty.' });
      }
      note.content = content;
    }

    await note.save();
    await note.populate('createdBy', 'username');
    await emitNoteUpdate(req, room._id);

    res.json({ note: formatNote(note) });
  } catch (error) {
    res.status(500).json({ message: 'Could not update note.' });
  }
});

router.delete('/:noteId', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const note = await Note.findOneAndDelete({ _id: req.params.noteId, room: room._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    await emitNoteUpdate(req, room._id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete note.' });
  }
});

module.exports = router;
