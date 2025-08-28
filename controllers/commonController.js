// routes/commonRoutes.js
const District = require('../models/districtModel');
const Bank = require('../models/bankModel');
const asyncHandler = require('express-async-handler');
const Connector = require('../models/connectorModel');

const getDistrictsBanks = asyncHandler(async (req, res) => {
    try {
        console.log('come to district')
        const districts = await District.find();
        const banks = await Bank.find();
        return res.status(200).json({
            success: true,
            data: {
                districts,
                banks
            }
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dropdown data',
            error: error.message
        });
    }
})

const getAllDistricts = asyncHandler(async (req, res) => {
    const districts = await District.find().select('name _id').lean();
    
    if (!districts || districts.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'No districts found'
        });
    }

    res.status(200).json({
        success: true,
        count: districts.length,
        data: districts
    });
});

const getConnectorsByType = asyncHandler(async (req, res) => {
    const { currentType } = req.params;
    
    if (!['AC', 'DC'].includes(currentType)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid connector type. Must be AC or DC'
        });
    }

    const connectors = await Connector.find({ current_type: currentType })
        .select('type_name _id')
        .lean();

    res.status(200).json({
        success: true,
        count: connectors.length,
        data: connectors
    });
});

module.exports = {
    getDistrictsBanks,
    getAllDistricts,
    getConnectorsByType
}