const asyncHandler = require('express-async-handler');
const Discussion = require('../models/discussionModel');

// POST → create discussion
const createDiscussion = asyncHandler(async (req, res) => {
  const { user, images, title, description, hashtags } = req.body;

  console.log('POST /create-discussion called with:', req.body);

  if (!user || !title || !description) {
    res.status(400);
    throw new Error('Please fill in all discussion fields');
  }

  // Create discussion with default values for pins, likes, and comments
  const discussion = await Discussion.create({
    user,
    images: images || [],
    title,
    description,
    hashtags: hashtags || [],
    isPinned: false,
    likes: 0,
    comments: []
  });

  console.log('Discussion saved:', discussion);

  res.status(201).json({
    success: true,
    message: 'Discussion created successfully',
    data: discussion
  });
});

// GET → get all discussions
const getAllDiscussions = asyncHandler(async (req, res) => {
  const discussions = await Discussion.find().sort({ createdAt: -1 });

  // Map discussions to a consistent structure for frontend
  const formattedDiscussions = discussions.map(d => ({
    id: d._id,
    user: d.user,
    title: d.title,
    description: d.description,
    images: d.images || [],
    hashtags: d.hashtags || [],
    isPinned: d.isPinned || false,
    likes: d.likes || 0,
    comments: d.comments || [],
    createdAt: d.createdAt
  }));

  console.log('GET /get-discussions:', formattedDiscussions);

  res.status(200).json({ success: true, data: formattedDiscussions });
});

module.exports = { createDiscussion, getAllDiscussions };
