const asyncHandler = require('express-async-handler');

const {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    deleteNotification
} = require('../services/notificationService');

const getNotifications = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 20, unread, userId, userModel } = req.query;
        // const { page = 1, limit = 20, unread } = req.query;
        // const { userId } = req.params;
        // const {userModel} = req.body;
        // console.log("recipient id in controller: ", userId)
        // console.log("recipient model in controller: ", userModel)

        const result = await getUserNotifications(
            userId,
            userModel,
            page,
            limit,
            unread == 'true'
        );

        res.status(200).json({
            success: true,
            data: result.notifications,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving notifications',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { userId } = req.params;
        // const userModel = req.body;

        const notification = await markAsRead(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notification as read',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        const { userModel } = req.body;

        const result = await markAllAsRead(userId, userModel);

        res.status(200).json({
            success: true,
            message: `Marked ${result.modifiedCount} notifications as read`
        });

        // console.log(res);
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking all notifications as read',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
})

const getUnreadNotificationCount = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        const { userModel } = req.body;

        //  console.log("recipient id in controller: ", userId)
        // console.log("recipient model in controller: ", userModel)


        const count = await getUnreadCount(userId, userModel);

        res.status(200).json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting unread count',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const deleteUserNotification = asyncHandler(async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { userId } = req.params;


        const notification = await deleteNotification(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting notification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount,
    deleteUserNotification
};