const asyncHandler = require('express-async-handler');
const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const Admin = require('../models/adminModel');
const StationOwner = require('../models/stationOwnerModel');
const SupportOfficer = require('../models/supportOfficerModel');

const createAutoChatsForStationOwner = asyncHandler(async (req, res) => {
    try {
        const { stationOwnerId } = req.body;
        if (!stationOwnerId) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required'
            });
        }

        // Check if station owner exists
        const stationOwner = await StationOwner.findById(stationOwnerId);
        if (!stationOwner) {
            return res.status(404).json({
                success: false,
                message: 'Station owner not found'
            });
        }

        const admin = await Admin.findOne();
        const supportOfficer = await SupportOfficer.findOne();

        if (!admin || !supportOfficer) {
            return res.status(404).json({
                success: false,
                message: 'Admin or Support Officer not found'
            });
        }

        let adminChat = null;
        let supportChat = null;
        let adminChatExists = false;
        let supportChatExists = false;

        // Check if admin chat already exists
        const existingAdminChat = await Chat.findOne({
            'participants.user_id': stationOwnerId,
            'participants.user_id': admin._id,
            'participants.role': 'stationowner',
            'participants.role': 'admin'
        });

        // Check if support chat already exists
        const existingSupportChat = await Chat.findOne({
            'participants.user_id': stationOwnerId,
            'participants.user_id': supportOfficer._id,
            'participants.role': 'stationowner',
            'participants.role': 'supportofficer'
        });

        // Create admin chat only if it doesn't exist
        if (!existingAdminChat) {
            adminChat = await Chat.create({
                participants: [
                    {
                        user_id: stationOwnerId,
                        role: 'stationowner',
                        modelType: 'stationowner'
                    },
                    {
                        user_id: admin._id,
                        role: 'admin',
                        modelType: 'Admin'
                    }
                ],
                topic: 'stationApproval',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        } else {
            adminChat = existingAdminChat;
            adminChatExists = true;
        }

        // Create support chat only if it doesn't exist
        if (!existingSupportChat) {
            supportChat = await Chat.create({
                participants: [
                    {
                        user_id: stationOwnerId,
                        role: 'stationowner',
                        modelType: 'stationowner'
                    },
                    {
                        user_id: supportOfficer._id,
                        role: 'supportofficer',
                        modelType: 'SupportOfficer'
                    }
                ],
                topic: 'support',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        } else {
            supportChat = existingSupportChat;
            supportChatExists = true;
        }

        res.status(201).json({
            success: true,
            message: 'Auto chats processed successfully',
            data: {
                adminChat,
                supportChat,
                adminChatExists,
                supportChatExists
            }
        });
    }
    catch (error) {
        console.error('Auto chat creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating auto chats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getUserChats = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID and role are required'
            });
        }

        const chats = await Chat.find({
            'participants.user_id': userId
        })
            .sort({ 'lastMessage.timestamp': -1, 'updatedAt': -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const chatsWithDetails = await Promise.all(
            chats.map(async (chat) => {
                const otherParticipant = chat.participants.find(
                    p => p.user_id.toString() !== userId
                );

                return {
                    ...chat,
                    otherParticipant
                };
            })
        );

        const total = await Chat.countDocuments({
            'participants.user_id': userId
        });

        res.status(200).json({
            success: true,
            data: chatsWithDetails,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalChats: total
            }
        });
    }
    catch (error) {
        console.error('Get user chats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving user chats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getChatMessages = asyncHandler(async (req, res) => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        if (!chatId) {
            return res.status(400).json({
                success: false,
                message: 'Chat ID is required'
            });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
        }
        const messages = await Message.find({ chat_id: chatId })
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const total = await Message.countDocuments({ chat_id: chatId });

        res.status(200).json({
            success: true,
            data: messages.reverse(), // Reverse to get chronological order
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalMessages: total
            }
        });

    }
    catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving chat messages',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const sendMessage = asyncHandler(async (req, res) => {
    try {
        const { chatId } = req.params;
        const { senderId, senderRole, message } = req.body;

        if (!chatId || !senderId || !senderRole || !message) {
            return res.status(400).json({
                success: false,
                message: 'Chat ID, sender ID, sender role, and message are required'
            });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
        }

        const isParticipant = chat.participants.some(
            p => p.user_id.toString() === senderId && p.role === senderRole
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: 'Not a participant in this chat'
            });
        }

        const newMessage = await Message.create({
            chat_id: chatId,
            sender: {
                user_id: senderId,
                role: senderRole
            },
            message,
            timestamp: new Date(),
            seenBy: [{
                userId: senderId,
                seenAt: new Date()
            }]
        });

        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: {
                text: message,
                senderId: senderId,
                senderRole: senderRole,
                timestamp: new Date()
            },
            updatedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const markMessagesAsSeen = asyncHandler(async (req, res) => {
    try {
        const { chatId } = req.params;
        const { userId } = req.body;

        if (!chatId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Chat ID and user ID are required'
            });
        }

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
        }

        await Message.updateMany(
            {
                chat_id: chatId,
                'seenBy.userId': { $ne: userId }
            },
            {
                $push: {
                    seenBy: {
                        userId: userId,
                        seenAt: new Date()
                    }
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Messages marked as seen'
        });

    } catch (error) {
        console.error('Mark messages as seen error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking messages as seen',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getUnreadMessageCount = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

       const userChats = await Chat.find({
            'participants.user_id': userId
        }).select('_id');

        const chatIds = userChats.map(chat => chat._id);

        // Count messages not seen by this user
        const unreadCount = await Message.countDocuments({
            chat_id: { $in: chatIds },
            'seenBy.userId': { $ne: userId }
        });

         res.status(200).json({
            success: true,
            data: { unreadCount }
        });


    } catch (error) {
        console.error('Get unread message count error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving unread message count',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    createAutoChatsForStationOwner,
    getUserChats,
    getChatMessages,
    sendMessage,
    markMessagesAsSeen,
    getUnreadMessageCount
}