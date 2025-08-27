const express = require('express');
const router = express.Router();
const {
    createAutoChatsForStationOwner,
    getUserChats,
    getChatMessages,
    sendMessage,
    markMessagesAsSeen,
    getUnreadMessageCount
} = require('../controllers/chatController');

// Chat routes
router.post('/auto-create', createAutoChatsForStationOwner);
router.get('/user/:userId', getUserChats);
router.get('/:chatId/messages', getChatMessages);
router.post('/:chatId/messages', sendMessage);
router.put('/:chatId/mark-seen', markMessagesAsSeen);
router.get('/user/:userId/unread-count', getUnreadMessageCount);

module.exports = router;