const express = require('express');
const router = express.Router();

const { 
  createDiscussion, 
  getAllDiscussions, 
  getDiscussionById, 
  addComment 
} = require('../controllers/discussionController');

// Routes
router.post('/create-discussion', createDiscussion);
router.get('/get-discussions', getAllDiscussions);
router.get('/discussions/:id', getDiscussionById);
router.post('/discussions/:id/comments', addComment);

module.exports = router;
