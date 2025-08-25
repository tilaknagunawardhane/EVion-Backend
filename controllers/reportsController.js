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
    const stationUser = await EvOwner.findById(userId);
    if (!stationUser) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    const stationObj = await PartneredChargingStation.findById(stationId);
    if (!stationObj) {
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
        // ...existing code for getBookingDetails...
        // Get the vehicle from the user's vehicles array
        const bookingUser = await EvOwner.findById(booking.ev_user_id._id)
            .select('vehicles')
            .lean();

        if (!bookingUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find the specific vehicle in the user's vehicles array
        const vehicle = bookingUser.vehicles.find(v => v._id.toString() === booking.vehicle_id.toString());
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        const bookingStation = await PartneredChargingStation.findById(booking.charging_station_id._id)
            .select('chargers')
            .lean();

        if (!bookingStation) {
            return res.status(404).json({
                success: false,
                message: 'Charging station not found'
            });
        }

        const charger = bookingStation.chargers.find(c => c._id.toString() === booking.charger_id.toString());
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
    } catch (error) {
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

    const bookingUser = await EvOwner.findById(userId);
    if (!bookingUser) {
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

        const existingReport = await BookingReport.findOne({
            user_id: userId,
            booking_id: bookingId
        })

        if (existingReport) {
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

const getAllReports = asyncHandler(async (req, res) => {
    try {
        const { type, status, page = 1, limit = 10, search } = req.query;
        let reports = [];
        let totalCount = 0;

        const userPopulate = { path: 'user_id', select: 'name email' };
        const stationPopulate = { path: 'station_id', select: 'station_name address city' };

        switch (type) {
            case 'stations':
                let stationQuery = {};

                if (status && status !== 'all') {
                    stationQuery.status = status;
                }
                if (search) {
                    stationQuery.$or = [
                        { category: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                [reports, totalCount] = await Promise.all([
                    StationReport.find(stationQuery)
                        .populate(userPopulate)
                        .populate(stationPopulate)
                        .sort({ createdAt: -1 })
                        .limit(limit * 1)
                        .skip((page - 1) * limit)
                        .lean(),
                    StationReport.countDocuments(stationQuery)
                ]);
                break;

            case 'chargers':
                let chargerQuery = {};
                if (status && status !== 'all') {
                    chargerQuery.status = status;
                }
                if (search) {
                    chargerQuery.$or = [
                        { category: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                reports = await ChargerReport.find(chargerQuery)
                    .populate(userPopulate)
                    .populate(stationPopulate)
                    .sort({ createdAt: -1 })
                    .limit(limit * 1)
                    .skip((page - 1) * limit)
                    .lean();

                totalCount = await ChargerReport.countDocuments(chargerQuery);
                break;

            case 'bookings':
                let bookingQuery = {};
                if (status && status !== 'all') {
                    bookingQuery.status = status;
                }
                if (search) {
                    bookingQuery.$or = [
                        { category: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                reports = await BookingReport.find(bookingQuery)
                    .populate(userPopulate)
                    .populate({
                        path: 'booking_id',
                        model: 'booking2',
                        populate: [
                            {
                                path: 'ev_user_id',
                                select: 'name email contact_number'
                            },
                            {
                                path: 'charging_station_id',
                                select: 'station_name address city station_status'
                            }
                        ]
                    })
                    .sort({ createdAt: -1 })
                    .limit(limit * 1)
                    .skip((page - 1) * limit)
                    .lean();

                totalCount = await BookingReport.countDocuments(bookingQuery);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type. Use stations, chargers, or bookings'
                });
        }

        // Process reports to get additional data (especially for bookings)
        const processedReports = await Promise.all(
            reports.map(async (report) => {
                const baseReport = {
                    id: report._id,
                    reportedOn: report.createdAt,
                    reportedBy: report.user_id?.name || 'Unknown',
                    reportCategory: report.category,
                    status: report.status,
                    description: report.description,
                    attachments: report.attachments || []
                };

                switch (type) {
                    case 'stations':
                        return {
                            ...baseReport,
                            stationName: report.station_id?.station_name || 'Unknown Station',
                            stationAddress: report.station_id?.address || '',
                            stationCity: report.station_id?.city || ''
                        };

                    case 'chargers':
                        // Get charger details from station
                        if (report.station_id && report.charger_id) {
                            const station = await PartneredChargingStation.findById(report.station_id._id)
                                .select('chargers')
                                .lean();

                            const charger = station?.chargers.find(c => c._id.toString() === report.charger_id.toString());

                            return {
                                ...baseReport,
                                stationName: report.station_id?.station_name || 'Unknown Station',
                                stationAddress: report.station_id?.address || '',
                                stationCity: report.station_id?.city || '',
                                chargerName: charger?.charger_name || 'Unknown Charger',
                                powerType: charger?.power_type || ''
                            };
                        }
                        return {
                            ...baseReport,
                            stationName: report.station_id?.station_name || 'Unknown Station',
                            stationAddress: report.station_id?.address || '',
                            stationCity: report.station_id?.city || '',
                            chargerName: 'Unknown Charger',
                            powerType: ''
                        };

                    case 'bookings':
                        if (!report.booking_id) {
                            return {
                                ...baseReport,
                                bookingId: 'Unknown Booking',
                                stationName: 'Unknown Station',
                                bookingDate: '',
                                bookingTime: ''
                            };
                        }

                        const booking = report.booking_id;

                        // Get vehicle data using the same approach as getBookingDetails
                        let vehicleData = {};
                        if (booking.ev_user_id && booking.vehicle_id) {
                            const user = await EvOwner.findById(booking.ev_user_id._id)
                                .select('vehicles')
                                .lean();

                            if (user) {
                                const vehicle = user.vehicles.find(v => v._id.toString() === booking.vehicle_id.toString());
                                if (vehicle) {
                                    vehicleData = {
                                        make: vehicle.make_info?.make || 'Unknown',
                                        model: vehicle.model_info?.model || 'Unknown',
                                        manufactured_year: vehicle.manufactured_year,
                                        battery_capacity: vehicle.battery_capacity,
                                        color: vehicle.color_info?.color || 'N/A',
                                        vehicle_type: vehicle.vehicle_type,
                                        connector_type_AC: vehicle.connector_type_AC_info?.type_name || 'N/A',
                                        connector_type_DC: vehicle.connector_type_DC_info?.type_name || 'N/A'
                                    };
                                }
                            }
                        }

                        // Get charger and connector details
                        let chargerData = {};
                        let connectorData = {};
                        if (booking.charging_station_id && booking.charger_id && booking.connector_type_id) {
                            const station = await PartneredChargingStation.findById(booking.charging_station_id._id)
                                .select('chargers')
                                .lean();

                            if (station) {
                                const charger = station.chargers.find(c => c._id.toString() === booking.charger_id.toString());
                                if (charger) {
                                    chargerData = {
                                        charger_name: charger.charger_name,
                                        power_type: charger.power_type,
                                        max_power_output: charger.max_power_output
                                    };

                                    const connector = charger.connector_types.find(ct => ct._id.toString() === booking.connector_type_id.toString());
                                    if (connector) {
                                        const connectorDetails = await ConnectorModel.findById(connector.connector)
                                            .select('type_name current_type')
                                            .lean();

                                        connectorData = {
                                            type_name: connectorDetails?.type_name || 'Unknown',
                                            current_type: connectorDetails?.current_type || 'Unknown'
                                        };
                                    }
                                }
                            }
                        }

                        return {
                            ...baseReport,
                            bookingId: booking._id,
                            stationName: booking.charging_station_id?.station_name || 'Unknown Station',
                            stationAddress: booking.charging_station_id?.address || '',
                            stationCity: booking.charging_station_id?.city || '',
                            bookingDate: booking.booking_date ? new Date(booking.booking_date).toLocaleDateString() : '',
                            bookingTime: booking.start_time ? new Date(booking.start_time).toLocaleTimeString() : '',
                            vehicleDetails: vehicleData,
                            chargerDetails: chargerData,
                            connectorDetails: connectorData
                        };

                    default:
                        return baseReport;
                }
            })
        );

        res.status(200).json({
            success: true,
            data: processedReports,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getReportDetails = asyncHandler(async (req, res) => {
    try {
        const { type, id } = req.params;
        // console.log('Received type:', type, 'and id:', id);
        if (!type || !id) {
            return res.status(400).json({
                success: false,
                message: 'Report type and ID are required'
            });
        }

        let report;
        switch (type) {
            case 'stations':
                report = await StationReport.findById(id)
                    .populate('user_id', 'name email contact_number')
                    .populate('station_id', 'station_name address city district station_status')
                    .populate('resolved_by', 'name email')
                    .lean();

                break;
            case 'chargers':
                report = await ChargerReport.findById(id)
                    .populate('user_id', 'name email contact_number')
                    .populate('station_id', 'station_name address city district station_status')
                    .populate('resolved_by', 'name email')
                    .lean();

                if (report && report.station_id) {
                    const station = await PartneredChargingStation.findById(report.station_id._id)
                        .select('chargers')
                        .lean();

                    if (station) {
                        const charger = station.chargers.find(c => c._id.toString() === report.charger_id.toString());
                        report.charger_details = charger || {};

                        if (charger) {
                            const connector = charger.connector_types.find(ct => ct._id.toString() === report.connector_id.toString());
                            if (connector) {
                                const connectorDetails = await ConnectorModel.findById(connector.connector)
                                    .select('type_name current_type')
                                    .lean();

                                report.connector_details = connectorDetails || {};
                            }
                        }
                    }
                }
                break;
            case 'bookings':
                report = await BookingReport.findById(id)
                    .populate('user_id', 'name email contact_number')
                    .populate('resolved_by', 'name email')
                    .populate({
                        path: 'booking_id',
                        model: 'booking2',
                        populate: [
                            {
                                path: 'charging_station_id',
                                select: 'station_name address city district station_status'
                            },
                            {
                                path: 'ev_user_id',
                                select: 'name email contact_number'
                            }
                        ]
                    })
                    .lean();

                if (report && report.booking_id) {
                    const booking = report.booking_id;

                    // Get vehicle data
                    const bookingUser = await EvOwner.findById(booking.ev_user_id._id)
                        .select('vehicles')
                        .lean();

                    if (bookingUser) {
                        const vehicle = bookingUser.vehicles.find(v => v._id.toString() === booking.vehicle_id.toString());
                        report.vehicle_details = vehicle ? {
                            make: vehicle.make_info?.make || 'Unknown',
                            model: vehicle.model_info?.model || 'Unknown',
                            manufactured_year: vehicle.manufactured_year,
                            battery_capacity: vehicle.battery_capacity,
                            color: vehicle.color_info?.color || 'N/A',
                            vehicle_type: vehicle.vehicle_type,
                            connector_type_AC: vehicle.connector_type_AC_info?.type_name || 'N/A',
                            connector_type_DC: vehicle.connector_type_DC_info?.type_name || 'N/A'
                        } : {};
                    }

                    if (booking.charging_station_id) {
                        const bookingStation = await PartneredChargingStation.findById(booking.charging_station_id._id)
                            .select('chargers')
                            .lean();

                        if (bookingStation) {
                            const charger = bookingStation.chargers.find(c => c._id.toString() === booking.charger_id.toString());
                            report.charger_details = charger ? {
                                charger_name: charger.charger_name,
                                power_type: charger.power_type,
                                max_power_output: charger.max_power_output,
                                price: charger.price
                            } : {};

                            if (charger) {
                                const connector = charger.connector_types.find(ct => ct._id.toString() === booking.connector_type_id.toString());
                                if (connector) {
                                    const connectorDetails = await ConnectorModel.findById(connector.connector)
                                        .select('type_name current_type image')
                                        .lean();
                                    report.connector_details = connectorDetails || {};
                                }

                            }
                        }
                    }
                }
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type'
                });
        }

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        res.status(200).json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Error fetching report details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching report details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
})

const saveReportAction = asyncHandler(async (req, res) => {
    try {
        const { type, id } = req.params;
        const { action, status, rejected_reason, refund_amount, resolved_by } = req.body;
        // const resolved_by = req.user.id;

        // console.log("resoled_by:", resolved_by);
        // console.log("type:", type);
        // console.log("id:", id);

        if (!action && status !== 'rejected') {
            return res.status(400).json({
                success: false,
                message: 'Action is required for resolution'
            });
        }
        if (status === 'rejected' && !rejected_reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required when rejecting a report'
            });
        }

        if (refund_amount && (isNaN(refund_amount) || refund_amount < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Refund amount must be a positive number'
            });
        }

        const updateData = {
            status,
            action: action || (status === 'rejected' ? 'Report rejected' : action),
            resolved_by,
            resolved_at: new Date(),
            ...(status === 'rejected' && { rejected_reason }),
            ...(refund_amount !== undefined && {
                refund_amount: parseFloat(refund_amount),
                is_refunded: refund_amount > 0
            })
        };
        let updatedReport;
        let reportModel;

        switch (type) {
            case 'stations':
                reportModel = StationReport;
                break;
            case 'chargers':
                reportModel = ChargerReport;
                break;
            case 'bookings':
                reportModel = BookingReport;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type. Use stations, chargers, or bookings'
                });
        }
        const existingReport = await reportModel.findById(id);
        if (!existingReport) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        if (existingReport.status !== 'under-review') {
            return res.status(400).json({
                success: false,
                message: 'Report has already been processed'
            });
        }
        updatedReport = await reportModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('user_id', 'name email')
            .populate('resolved_by', 'name email');

        if (type === 'bookings') {
            await updatedReport.populate({
                path: 'booking_id',
                populate: [
                    {
                        path: 'charging_station_id',
                        select: 'station_name address city'
                    }
                ]
            });
        } else {
            await updatedReport.populate('station_id', 'station_name address city');
        }
        if (!updatedReport) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Report ${status} successfully`,
            data: updatedReport
        });
    } catch (error) {
        console.error('Error saving report action:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while saving report action',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add this to your reportController.js
const updateRefund = asyncHandler(async (req, res) => {
    try {
        const { type, id } = req.params;
        const { refund_amount } = req.body;

        if (type !== 'bookings') {
            return res.status(400).json({
                success: false,
                message: 'Refunds can only be added to booking reports'
            });
        }

        if (!refund_amount || isNaN(refund_amount) || refund_amount < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid refund amount is required'
            });
        }

        const report = await BookingReport.findById(id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        if (report.status !== 'resolved') {
            return res.status(400).json({
                success: false,
                message: 'Refunds can only be added to resolved reports'
            });
        }

        const updatedReport = await BookingReport.findByIdAndUpdate(
            id,
            {
                refund_amount: parseFloat(refund_amount),
                is_refunded: refund_amount > 0
            },
            { new: true, runValidators: true }
        ).populate('user_id', 'name email')
            .populate('resolved_by', 'name email')
            .populate({
                path: 'booking_id',
                populate: [{ path: 'charging_station_id', select: 'station_name address city' }]
            });

        res.status(200).json({
            success: true,
            message: 'Refund updated successfully',
            data: updatedReport
        });

    } catch (error) {
        console.error('Error updating refund:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating refund',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getEvOwnerReports = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        console.log('Fetching reports for userId:', userId, 'with status:', status, 'page:', page, 'limit:', limit);
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Build query based on status
        const query = { user_id: userId };
        if (status && status !== 'all') {
            query.status = status;
        }

        // Get reports from all three collections
        const [stationReports, chargerReports, bookingReports] = await Promise.all([
            StationReport.find(query)
                .populate('station_id', 'station_name address city')
                .sort({ createdAt: -1 })
                .lean(),
            ChargerReport.find(query)
                .populate('station_id', 'station_name address city')
                .sort({ createdAt: -1 })
                .lean(),
            BookingReport.find(query)
                .populate({
                    path: 'booking_id',
                    populate: {
                        path: 'charging_station_id',
                        select: 'station_name address city'
                    }
                })
                .sort({ createdAt: -1 })
                .lean()
        ]);

        // Process charger reports to get charger details
        const processedChargerReports = await Promise.all(
            chargerReports.map(async (report) => {
                if (report.station_id && report.charger_id) {
                    try {
                        const station = await PartneredChargingStation.findById(report.station_id._id)
                            .select('chargers')
                            .lean();
                        
                        if (station) {
                            const charger = station.chargers.find(c => c._id.toString() === report.charger_id.toString());
                            return {
                                ...report,
                                charger_details: charger || {}
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching charger details:', error);
                    }
                }
                return report;
            })
        );

        // Combine and format all reports
        const allReports = [
            ...stationReports.map(report => ({
                ...report,
                type: 'station',
                title: `Station Report - ${report.category}`,
                reference: report._id
            })),
            ...processedChargerReports.map(report => ({
                ...report,
                type: 'charger',
                title: `Charger Report - ${report.category}`,
                reference: report._id,
                charger_name: report.charger_details?.charger_name || 'Unknown Charger'
            })),
            ...bookingReports.map(report => ({
                ...report,
                type: 'booking',
                title: `Booking Report - ${report.category}`,
                reference: report._id
            }))
        ];

        // console.log(`Total reports found: ${allReports.length}`);
        // console.log('All Reports:', allReports);

        // Sort by creation date (newest first)
        allReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedReports = allReports.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedReports,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(allReports.length / limit),
                totalItems: allReports.length,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching EV owner reports:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getEvOwnerReportDetails = asyncHandler(async (req, res) => {
    try {
        const { userId, reportId, type } = req.params;
        console.log('Fetching report details for userId:', userId, 'reportId:', reportId, 'type:', type);

        if (!userId || !reportId || !type) {
            return res.status(400).json({
                success: false,
                message: 'User ID, Report ID, and Type are required'
            });
        }

        let report;
        switch (type) {
            case 'station':
                report = await StationReport.findOne({ _id: reportId, user_id: userId })
                    .populate('station_id', 'station_name address city district')
                    .populate('resolved_by', 'name email')
                    .lean();
                break;

            case 'charger':
                report = await ChargerReport.findOne({ _id: reportId, user_id: userId })
                    .populate('station_id', 'station_name address city district')
                    .populate('resolved_by', 'name email')
                    .lean();

                // Get charger details manually
                if (report && report.station_id) {
                    const station = await PartneredChargingStation.findById(report.station_id._id)
                        .select('chargers')
                        .lean();
                    
                    if (station) {
                        const charger = station.chargers.find(c => c._id.toString() === report.charger_id.toString());
                        report.charger_details = charger || {};
                    }
                }
                break;

            case 'booking':
                report = await BookingReport.findOne({ _id: reportId, user_id: userId })
                    .populate({
                        path: 'booking_id',
                        populate: {
                            path: 'charging_station_id',
                            select: 'station_name address city district'
                        }
                    })
                    .populate('resolved_by', 'name email')
                    .lean();
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type'
                });
        }

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found or access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Error fetching report details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching report details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    submitStationReport,
    submitChargerReport,
    getBookingDetails,
    submitBookingReport,
    getAllReports,
    getReportDetails,
    saveReportAction,
<<<<<<< HEAD
    updateRefund
};
=======
    updateRefund,
    getEvOwnerReports,
    getEvOwnerReportDetails
}
>>>>>>> 91b285c (Fault report section fetch data)
