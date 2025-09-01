const Notification = require('../models/notificationModel')

const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();

    console.log(`Notification created: ${notification.title}`);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

const getUserNotifications = async (userId, userModel, page = 1, limit = 20, unreadOnly = false) => {
  try {
    const query = {
      recipientId: userId,
      recipientModel: userModel
    };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Notification.countDocuments(query);

    return {
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalNotifications: total
      }
    };

  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { isRead: true },
      { new: true } //updated document will be returned, not the original
    );

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

const markAllAsRead = async (userId, userModel) => {
  try {
    const result = await Notification.updateMany(
      { recipientId: userId, recipientModel: userModel, isRead: false },
      { isRead: true }
    );

    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

const getUnreadCount = async (userId, userModel) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: userId,
      recipientModel: userModel,
      isRead: false
    });

    return count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
}

const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipientId: userId
    });

    return notification;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
};