const mongoose = require('mongoose');
const Room = require('../models/Room');

async function getAccessibleRoom(roomId, userId) {
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    return null;
  }

  return Room.findOne({ _id: roomId, members: userId })
    .populate('owner', 'username')
    .populate('members', 'username');
}

module.exports = {
  getAccessibleRoom
};
