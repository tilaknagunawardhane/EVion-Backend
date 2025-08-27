const asyncHandler = require('express-async-handler');
const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const Admin = require('../models/adminModel');
const StationOwner = require('../models/stationOwnerModel');
const SupportOfficer = require('../models/supportOfficerModel');

const createAutoChatsForStationOwner = asyncHandler(async (requestAnimationFrame, res) => {
    try {
        const { stationOwnerId } = req.body;
        if (!stationOwnerId) {
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

        const adminChat = await Chat.create({
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

        const supportChat = await Chat.create({
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

        res.status(201).json({
            success: true,
            message: 'Auto chats created successfully',
            data: {
                adminChat,
                supportChat
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
})