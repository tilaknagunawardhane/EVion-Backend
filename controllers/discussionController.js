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

  const formattedDiscussions = discussions.map(d => ({
    id: d._id,
    user: d.user,
    title: d.title,
    description: d.description,
    images: d.images || [],
    hashtags: d.hashtags || [], // optional
    isPinned: d.isPinned || false,
    likes: d.likes || 0,
    comments: d.comments || [],
    createdAt: d.createdAt
  }));

  res.status(200).json({ success: true, data: formattedDiscussions });
});


// GET → single discussion by ID
const getDiscussionById = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findById(req.params.id);
  if (!discussion) {
    res.status(404);
    throw new Error("Discussion not found");
  }

  res.status(200).json({
    success: true,
    data: discussion
  });
});

// POST → add a comment
const addComment = asyncHandler(async (req, res) => {
  const { text, user } = req.body; // frontend sends { text, user }

  if (!text) {
    res.status(400);
    throw new Error("Comment text required");
  }

  const discussion = await Discussion.findById(req.params.id);
  if (!discussion) {
    res.status(404);
    throw new Error("Discussion not found");
  }

  const newComment = {
    user: user || "Anonymous",
    text, // keep consistent with frontend
    created_at: new Date()
  };

  discussion.comments.push(newComment);
  await discussion.save();

  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: newComment
  });
});

module.exports = { 
  createDiscussion, 
  getAllDiscussions, 
  getDiscussionById, 
  addComment 
};
