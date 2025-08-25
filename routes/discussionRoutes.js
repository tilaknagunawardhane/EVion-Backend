const express = require('express');
const router = express.Router();
const { createDiscussion, getAllDiscussions } = require('../controllers/discussionController');

router.post('/create-discussion', createDiscussion);
router.get('/get-discussions', getAllDiscussions);

module.exports = router;
