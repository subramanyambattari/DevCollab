const express = require('express');
const Task = require('../models/Task');
const requireAuth = require('../middleware/auth');
const { getAccessibleRoom } = require('../utils/access');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

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

async function emitTaskUpdate(req, roomId) {
  const io = req.app.get('io');
  if (io) {
    const tasks = await Task.find({ room: roomId }).sort({ status: 1, order: 1, createdAt: 1 });
    io.to(roomId.toString()).emit('tasks:updated', {
      roomId: roomId.toString(),
      tasks: tasks.map(formatTask)
    });
  }
}

router.get('/', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const tasks = await Task.find({ room: room._id })
      .sort({ status: 1, order: 1, createdAt: 1 })
      .populate('createdBy', 'username');
    res.json({ tasks: tasks.map(formatTask) });
  } catch (error) {
    res.status(500).json({ message: 'Could not load tasks.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const status = ['todo', 'doing', 'done'].includes(req.body.status) ? req.body.status : 'todo';

    if (!title) {
      return res.status(400).json({ message: 'Task title is required.' });
    }

    const taskCount = await Task.countDocuments({ room: room._id, status });
    const task = await Task.create({
      room: room._id,
      title,
      description,
      status,
      order: taskCount,
      createdBy: req.user._id
    });

    await task.populate('createdBy', 'username');
    await emitTaskUpdate(req, room._id);
    res.status(201).json({ task: formatTask(task) });
  } catch (error) {
    res.status(500).json({ message: 'Could not create task.' });
  }
});

router.patch('/:taskId', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const task = await Task.findOne({ _id: req.params.taskId, room: room._id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (typeof req.body.title === 'string') {
      const title = req.body.title.trim();
      if (!title) {
        return res.status(400).json({ message: 'Task title cannot be empty.' });
      }
      task.title = title;
    }

    if (typeof req.body.description === 'string') {
      task.description = req.body.description.trim();
    }

    if (typeof req.body.status === 'string' && ['todo', 'doing', 'done'].includes(req.body.status)) {
      task.status = req.body.status;
    }

    if (typeof req.body.order === 'number' && Number.isFinite(req.body.order)) {
      task.order = req.body.order;
    }

    await task.save();
    await task.populate('createdBy', 'username');
    await emitTaskUpdate(req, room._id);

    res.json({ task: formatTask(task) });
  } catch (error) {
    res.status(500).json({ message: 'Could not update task.' });
  }
});

router.delete('/:taskId', async (req, res) => {
  try {
    const room = await getAccessibleRoom(req.params.roomId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    const task = await Task.findOneAndDelete({ _id: req.params.taskId, room: room._id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    await emitTaskUpdate(req, room._id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete task.' });
  }
});

module.exports = router;
