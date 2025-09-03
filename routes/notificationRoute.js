const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteUserNotification
} = require('../controllers/notificationController');

router.post('/:userId', getNotifications);
router.put('/:notificationId/read', markNotificationAsRead);
router.put('/read-all/:userId', markAllNotificationsAsRead);
router.post('/unread-count/:userId', getUnreadNotificationCount);
router.get('/:notificationId', deleteUserNotification);

module.exports = router;

