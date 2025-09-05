const { createNotification } = require('../services/notificationService');

const notifyNewStation = async (station, owner) => {
    try {
        await createNotification({
            recipientType: 'admin',
            recipientId: await getAdminId(),
            recipientModel: 'Admin',
            title: "New Station Registration",
            message: `A new charging station "${station.station_name}" has been registered by ${owner.name}. Needs approval.`,
            type: 'station_added',
            relatedEntity: {
                id: station._id,
                model: 'PartneredChargingStation'
            },
            priority: 'high'
        });

        await createNotification({
            recipientType: 'supportofficer',
            recipientId: await getSupportOfficerId(),
            recipientModel: 'SupportOfficer',
            title: "New Station Registration",
            message: `A new charging station "${station.station_name}" has been registered by ${owner.name}.`,
            type: 'station_added',
            relatedEntity: {
                id: station._id,
                model: 'PartneredChargingStation'
            },
            priority: 'medium'
        });
    } catch (error) {
        console.error('Error sending new station notifications:', error);
    }
}

const notifyStationStatus = async (station, status, reviewedBy) => {
    try {
        const action = status === 'approved' ? 'approved' : 'rejected';

        await createNotification({
            recipientType: 'stationowner',
            recipientId: station.ownerId,
            recipientModel: 'stationowner',
            title: `Station ${action.charAt(0).toUpperCase() + action.slice(1)}`,
            message: `Your charging station "${station.station_name}" has been ${action} by the admin.`,
            type: status === 'approved' ? 'station_approved' : 'station_rejected',
            relatedEntity: {
                id: station._id,
                model: 'PartneredChargingStation'
            },
            priority: 'high'
        });
    } catch (error) {
        console.error('Error sending station status notifications:', error);
    }
};

const notifyNewReport = async (report, Type, station) => {
    try {
        await createNotification({
            recipientType: 'supportofficer',
            recipientId: await getSupportOfficerId(),
            recipientModel: 'SupportOfficer',
            title: 'New Report Submitted',
            message: `A new report has been submitted regarding ${Type}.`,
            type: 'new_report',
            relatedEntity: {
                id: report._id,
                model: 'Report'
            },
            priority: 'high'
        });

        await createNotification({
            recipientType: 'stationowner',
            recipientId: station.station_owner_id,
            recipientModel: 'stationowner',
            title: 'New Report Submitted',
            message: `A new report has been submitted regarding ${Type}.`,
            type: 'new_report',
            relatedEntity: {
                id: report._id,
                model: 'Report'
            },
            priority: 'high'
        });

    } catch (error) {
        console.error('Error sending new report notifications:', error);
    }
};

const getAdminId = async () => {
    const Admin = require('../models/adminModel');
    const admin = await Admin.findOne();
    return admin._id;
};

const getSupportOfficerId = async () => {
    const SupportOfficer = require('../models/supportOfficerModel');
    const supportOfficer = await SupportOfficer.findOne();
    return supportOfficer._id;
}


module.exports = {
    notifyNewStation,
    notifyStationStatus,
    notifyNewReport
};