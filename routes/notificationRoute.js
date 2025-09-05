const express = require('express');
const router = express.Router();

const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteUserNotification
} = require('../controllers/notificationController');

router.get('/', getNotifications);
router.put('/:notificationId/read/:userId', markNotificationAsRead);
router.put('/read-all/:userId', markAllNotificationsAsRead);
router.post('/unread-count/:userId', getUnreadNotificationCount);
router.delete('/:notificationId/:userId', deleteUserNotification);

module.exports = router;

