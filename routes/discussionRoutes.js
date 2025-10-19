const express = require('express');
const router = express.Router();

const { 
  createDiscussion, 
  getAllDiscussions, 
  getAllFlaggedDiscussions,
  getDiscussionById, 
  addComment,
  togglePinStatus, 
  flagDiscussion,   
  deleteDiscussion,
  getCommunityStats 
} = require('../controllers/discussionController');

router.post('/create-discussion', createDiscussion);
router.get('/get-discussions', getAllDiscussions); 
router.get('/discussions/:id', getDiscussionById);

router.post('/discussions/:id/comments', addComment);
router.get('/get-flagged-discussions', getAllFlaggedDiscussions);

router.put('/discussions/:id/pin', togglePinStatus); 
router.post('/discussions/:id/flag', flagDiscussion);
router.delete('/discussions/:id', deleteDiscussion); 
router.get('/get-stats', getCommunityStats);

module.exports = router;