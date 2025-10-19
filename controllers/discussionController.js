const asyncHandler = require('express-async-handler');
const Discussion = require('../models/discussionModel');
const mongoose = require('mongoose');

// POST → create discussion
const createDiscussion = asyncHandler(async (req, res) => {
  const { user, images, title, description, hashtags } = req.body;

  if (!user || !title || !description) {
    res.status(400);
    throw new Error('Please fill in all discussion fields');
  }

  // Use Discussion.create to atomically save the new post
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

  // Return the newly created document.
  res.status(201).json({
    success: true,
    message: 'Discussion created successfully',
    data: discussion
  });
});

// GET → get all discussions "My Discussions" filtering
const getAllDiscussions = asyncHandler(async (req, res) => {
  const { user } = req.query; // Check for ?user=... for "My Discussions"

  let filter = {};
  if (user) {
    filter.user = user; 
  }

  // Mongoose .find() is correct. Documents are sorted by creation date (newest first).
  const discussions = await Discussion.find(filter).sort({ createdAt: -1 });

  // Map to the format the frontend expects
  const formattedDiscussions = discussions.map(d => ({
    id: d._id,
    user: d.user,
    title: d.title,
    description: d.description,
    images: d.images || [],
    hashtags: d.hashtags || [], 
    isPinned: d.isPinned || false,
    comments: d.comments || [],
    createdAt: d.createdAt 
  }));

  res.status(200).json({ success: true, data: formattedDiscussions });
});


// GET → single discussion by ID (Existing, correct)
const getDiscussionById = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findById(req.params.id);
  if (!discussion) {
    res.status(404);
    throw new Error("Discussion not found");
  }
  res.status(200).json({ success: true, data: discussion });
});

// PUT → toggle pin status (New)
const togglePinStatus = asyncHandler(async (req, res) => {
  const { isPinned } = req.body; 

  if (typeof isPinned !== 'boolean') {
    res.status(400);
    throw new Error('Invalid pin status provided');
  }

  const discussion = await Discussion.findByIdAndUpdate(
    req.params.id,
    { isPinned },
    { new: true } // Return the updated document
  );

  if (!discussion) {
    res.status(404);
    throw new Error("Discussion not found");
  }

  res.status(200).json({
    success: true,
    message: `Post ${isPinned ? 'pinned' : 'unpinned'} successfully`,
    data: discussion.isPinned
  });
});

// POST → flag discussion (Corrected)
const flagDiscussion = asyncHandler(async (req, res) => {
  const { reason } = req.body; 
  const discussionId = req.params.id;

  if (!reason || !['spam', 'harassment', 'other'].includes(reason)) {
    res.status(400);
    throw new Error("Invalid or missing flag reason");
  }
  
  // 1. Atomically increment the specific flag count
  const update = { $inc: { [`flagged_count.${reason}`]: 1 } };
  
  // Find and update the discussion, returning the NEW document
  let discussion = await Discussion.findByIdAndUpdate(
    discussionId,
    update,
    { new: true, runValidators: true } // {new: true} is crucial
  );
  
  if (!discussion) {
    res.status(404);
    throw new Error("Discussion not found");
  }

  // 2. Calculate the total flags from the current, updated document state
  const totalFlags = (discussion.flagged_count.spam || 0) +
                     (discussion.flagged_count.harassment || 0) +
                     (discussion.flagged_count.other || 0);
  
  // 3. Update the flagged_status if it doesn't match the new total
  const newFlaggedStatus = totalFlags > 5;
  
  if (discussion.flagged_status !== newFlaggedStatus) {
    // Perform a targeted update for flagged_status only
    discussion.flagged_status = newFlaggedStatus;
    
    // Use .save() to update the flagged_status field in the DB
    // Since we only changed the status field, this is safe and correct.
    await discussion.save(); 
  }


  res.status(200).json({
    success: true,
    message: "Post successfully flagged for review",
    data: {
      totalFlags: totalFlags, 
      flaggedStatus: discussion.flagged_status,
    }
  });
});

// GET → get all highly-flagged discussions (for Moderation)
const getAllFlaggedDiscussions = asyncHandler(async (req, res) => {
  // Filter only for discussions that have been marked as needing review (flagged_status: true)
  const filter = { flagged_status: true }; 

  // Fetch documents matching the filter, sorted by creation date
  const discussions = await Discussion.find(filter).sort({ createdAt: -1 });

  // Map to the format the frontend expects, including all moderation fields
  const formattedDiscussions = discussions.map(d => ({
    _id: d._id, 
    user: d.user,
    title: d.title,
    description: d.description,
    images: d.images || [],
    hashtags: d.hashtags || [], 
    isPinned: d.isPinned || false,
    likes: d.likes || 0,
    comments: d.comments || [],
    createdAt: d.createdAt,
    
    // Include Flagging and Moderation Fields
    flagged_count: d.flagged_count || { spam: 0, harassment: 0, other: 0 },
    flagged_status: d.flagged_status || false,
  }));

  res.status(200).json({ success: true, data: formattedDiscussions });
});

// POST → add a comment / nested reply
const addComment = asyncHandler(async (req, res) => {
  // Expected body: { text, user, replyingTo: commentId (optional) }
  const { text, user, replyingTo } = req.body; 
  const discussionId = req.params.id;

  if (!text) {
    res.status(400);
    throw new Error("Comment text required");
  }

  const newCommentOrReply = {
    _id: new mongoose.Types.ObjectId(), // Generate unique ID for the new item
    user: user || "Anonymous",
    text,
    created_at: new Date()
  };

  let updateResult;

  if (replyingTo) {
    // Handle Nested Reply: Push to the 'replies' array of the target comment
    updateResult = await Discussion.findOneAndUpdate(
      { '_id': discussionId, 'comments._id': replyingTo },
      { $push: { 'comments.$.replies': newCommentOrReply } },
      { new: true }
    );
    
    if (!updateResult) {
      res.status(404);
      throw new Error("Parent comment or discussion not found");
    }

  } else {
    // Handle Top-Level Comment: Push to the main 'comments' array
    const topLevelComment = { ...newCommentOrReply, replies: [] };
    
    updateResult = await Discussion.findByIdAndUpdate(
      discussionId,
      { $push: { comments: topLevelComment } },
      { new: true }
    );

    if (!updateResult) {
      res.status(404);
      throw new Error("Discussion not found");
    }
  }

  res.status(201).json({
    success: true,
    message: replyingTo ? "Reply added successfully" : "Comment added successfully",
    data: newCommentOrReply 
  });
});
// DELETE → delete discussion by ID
// DELETE → delete discussion by ID
const deleteDiscussion = asyncHandler(async (req, res) => {
  const discussionId = req.params.id;
  
  // ⭐ FIX: Validate the ID format FIRST
  if (!mongoose.Types.ObjectId.isValid(discussionId)) {
    res.status(400); // Bad Request
    throw new Error(`Invalid Discussion ID format: ${discussionId}`);
  }
    
  // Use findByIdAndDelete to remove the document
  const discussion = await Discussion.findByIdAndDelete(discussionId);

  if (!discussion) {
    res.status(404);
    throw new Error("Discussion not found");
  }

  // Respond with a success message for deletion
  res.status(200).json({ 
    success: true, 
    message: "Discussion successfully deleted" 
  });
});

// GET → get overall community moderation statistics
const getCommunityStats = asyncHandler(async (req, res) => {
    // Calculate Total Posts
    const totalPosts = await Discussion.countDocuments({});

    // Calculate Flags Received (Total Flags)
    // Use aggregation to sum up all 'spam', 'harassment', and 'other' counts
    const flagAggregation = await Discussion.aggregate([
        {
            $group: {
                _id: null, // Group all documents
                totalSpam: { $sum: "$flagged_count.spam" },
                totalHarassment: { $sum: "$flagged_count.harassment" },
                totalOther: { $sum: "$flagged_count.other" }
            }
        }
    ]);

    let totalFlagsReceived = 0;
    if (flagAggregation.length > 0) {
        const result = flagAggregation[0];
        totalFlagsReceived = (result.totalSpam || 0) + 
                             (result.totalHarassment || 0) + 
                             (result.totalOther || 0);
    }
    
    // Calculate Last Post On
    const lastPost = await Discussion.findOne().sort({ createdAt: -1 }).select('createdAt');
    const lastPostOn = lastPost ? lastPost.createdAt : null;

    res.status(200).json({
        success: true,
        data: {
            totalPosts: totalPosts,
            flagsReceived: totalFlagsReceived,
            lastPostOn: lastPostOn,
        }
    });
});

module.exports = { 
  createDiscussion, 
  getAllDiscussions, 
  getDiscussionById, 
  addComment,
  togglePinStatus,
  flagDiscussion,
  deleteDiscussion,
  getAllFlaggedDiscussions,
  getCommunityStats 
};