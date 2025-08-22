const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const EvOwner = require('../models/evOwnerModel');
const StationReport = require('../models/stationReportModel');
const ChargerReport = require('../models/chargerReportModel');
const BookingReport = require('../models/bookingReportModel');
const Booking2 = require('../models/booking2Model'); // Import the new booking model
const ConnectorModel = require('../models/connectorModel'); // Assuming you have a connector model

const submitStationReport = asyncHandler(async (req, res) => {
    const { userId, stationId, category, description, attachments = [] } = req.body;

    // Validate required fields
    if (!userId || !stationId || !category || !description) {
        return res.status(400).json({
            success: false,
            message: 'User ID, Station ID, Category, and Description are required'
        });
    }

    // Check if the user exists
    const user = await EvOwner.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    const station = await PartneredChargingStation.findById(stationId);
    if (!station) {
        return res.status(404).json({
            success: false,
            message: 'Charging station not found'
        });
    }

    if (attachments && attachments.length > 5) {
        return res.status(400).json({
            success: false,
            message: 'Maximum 5 attachments allowed'
        });
    }

    // Create the report
    const report = new StationReport({
        user_id: userId,
        station_id: stationId,
        category,
        description,
        attachments: attachments || [],
        status: 'under-review'
    });
    await report.save();

    res.status(201).json({
        success: true,
        message: 'Report submitted successfully',
        report
    });
});

const submitChargerReport = asyncHandler(async (req, res) => {
    const { userId, stationId, chargerId, connectorId, category, description, attachments = [] } = req.body;
    console.log('Received data:', req.body);

    // Validate required fields
    if (!userId || !stationId || !chargerId || !connectorId || !category || !description) {
        return res.status(400).json({
            success: false,
            message: 'User ID, Station ID, Charger ID, Connector ID, Category, and Description are required'
        });
    }

    // Check if the user exists
    const user = await EvOwner.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    // Check if station exists
    const station = await PartneredChargingStation.findById(stationId);
    if (!station) {
        return res.status(404).json({
            success: false,
            message: 'Charging station not found'
        });
    }

    // Check if charger exists in the station
    const chargerExists = station.chargers.id(chargerId);
    if (!chargerExists) {
        return res.status(404).json({
            success: false,
            message: 'Charger not found in this station'
        });
    }

    // Check if connector exists in the charger
    const connectorExists = chargerExists.connector_types.id(connectorId);
    if (!connectorExists) {
        return res.status(404).json({
            success: false,
            message: 'Connector not found in this charger'
        });
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 1000) {
        return res.status(400).json({
            success: false,
            message: 'Description cannot exceed 1000 characters'
        });
    }

    // Validate attachments
    if (attachments.length > 5) {
        return res.status(400).json({
            success: false,
            message: 'Maximum 5 attachments allowed'
        });
    }

    // Create the report
    const report = new ChargerReport({
        user_id: userId,
        station_id: stationId,
        charger_id: chargerId,
        connector_id: connectorId,
        category,
        description: trimmedDescription,
        attachments: attachments,
        status: 'under-review'
    });

    await report.save();

    // Populate the report for better response
    const populatedReport = await ChargerReport.findById(report._id)
        .populate('user_id', 'name email')
        .populate('station_id', 'station_name address city')
        .lean();

    res.status(201).json({
        success: true,
        message: 'Charger report submitted successfully',
        data: populatedReport
    });
});

const getBookingDetails = asyncHandler(async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID is required'
            });
        }

        const booking = await Booking2.findById(bookingId)
            .populate('ev_user_id', 'name email contact_number')
            .populate('charging_station_id', 'station_name address city station_status')
            .lean();

        console.log('Booking details:', booking);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Get the vehicle from the user's vehicles array
        const user = await EvOwner.findById(booking.ev_user_id._id)
            .select('vehicles')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find the specific vehicle in the user's vehicles array
        const vehicle = user.vehicles.find(v => v._id.toString() === booking.vehicle_id.toString());
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        const station = await PartneredChargingStation.findById(booking.charging_station_id._id)
            .select('chargers')
            .lean();

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Charging station not found'
            });
        }

        const charger = station.chargers.find(c => c._id.toString() === booking.charger_id.toString());
        if (!charger) {
            return res.status(404).json({
                success: false,
                message: 'Charger not found'
            });
        }

        const connector = charger.connector_types.find(ct => ct._id.toString() === booking.connector_type_id.toString());
        if (!connector) {
            return res.status(404).json({
                success: false,
                message: 'Connector not found'
            });
        }

        const connectorDetails = await ConnectorModel.findById(connector.connector)
            .select('type_name current_type')

        if (!connectorDetails) {
            return res.status(404).json({
                success: false,
                message: 'Connector details not found'
            });
        }

        // Format vehicle data for response
        const vehicleData = {
            _id: vehicle._id,
            make: vehicle.make_info?.make || 'Unknown',
            model: vehicle.model_info?.model || 'Unknown',
            manufactured_year: vehicle.manufactured_year,
            battery_capacity: vehicle.battery_capacity,
            color: vehicle.color_info?.color || 'N/A',
            vehicle_type: vehicle.vehicle_type,
            connector_type_AC: vehicle.connector_type_AC_info?.type_name || 'N/A',
            connector_type_DC: vehicle.connector_type_DC_info?.type_name || 'N/A',
            battery_health: vehicle.battery_health,
            max_power_AC: vehicle.max_power_AC,
            max_power_DC: vehicle.max_power_DC
        };

        const response = {
            _id: booking._id,
            user_id: booking.ev_user_id,
            vehicle_id: vehicleData, // Use the formatted vehicle data
            station_id: booking.charging_station_id,
            charger_id: {
                _id: charger._id,
                charger_name: charger.charger_name,
                power_type: charger.power_type,
                max_power_output: charger.max_power_output,
                price: charger.price
            },
            connector_id: {
                _id: connector._id,
                type_name: connectorDetails.type_name || 'Unknown',
                current_type: connectorDetails.current_type || 'Unknown'
            },
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            no_of_slots: booking.no_of_slots,
            status: booking.status,
            arrival_time: booking.arrival_time,
            cancelled_at: booking.cancelled_at,
            cost: booking.cost,
            created_at: booking.createdAt,
            updated_at: booking.updatedAt
        };

        console.log('Booking details response:', response);
        res.status(200).json({
            success: true,
            data: response
        });
    }
    catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching booking details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const submitBookingReport = asyncHandler(async (req, res) => {
    try {
        const { userId, bookingId, category, description, attachments = [] } = req.body;
        if (!userId || !bookingId || !category || !description) {
            return res.status(400).json({
                success: false,
                message: 'User ID, Booking ID, Category, and Description are required'
            });
        }

        const user = await EvOwner.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const booking = await Booking2.findOne({
            _id: bookingId,
            ev_user_id: userId
        });

        const trimmedDescription = description.trim();
        if (trimmedDescription.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Description cannot exceed 1000 characters'
            });
        }

        // Validate attachments
        if (attachments.length > 5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 5 attachments allowed'
            });
        }

        const existingReport  = await BookingReport.findOne({
            user_id: userId,
            booking_id: bookingId
        })

        if(existingReport){
            return res.status(400).json({
                success: false,
                message: 'You have already submitted a report for this booking'
            });
        }

        const report = new BookingReport({
            user_id: userId,
            booking_id: bookingId,
            category,
            description: trimmedDescription,
            attachments: attachments,
            status: 'under-review'
        });

        await report.save();

        const populatedReport = await BookingReport.findById(report._id)
            .populate({
                path: 'user_id',
                model: 'EvOwner',
                select: 'name email'
            })
            .populate({
                path: 'booking_id',
                model: 'booking2',
                select: 'start_time end_time status cost'
            })
            .lean();

        res.status(201).json({
            success: true,
            message: 'Booking report submitted successfully',
            data: populatedReport
        });

    } catch (error) {
        console.error('Error submitting booking report:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while submitting booking report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
})

module.exports = {
    submitStationReport,
    submitChargerReport,
    getBookingDetails,
    submitBookingReport
}