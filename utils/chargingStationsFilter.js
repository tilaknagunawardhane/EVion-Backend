require('dotenv').config();

const API_KEY = process.env.OPEN_CHARGE_MAP_API_KEY;
const PartneredChargingStation = require('../models/partneredChargingStationModel.js');
const { estimateBatteryConsumption, estimateMaxDistance } = require('./batteryEstimator.js');
const decodePolyline = require('./decodePolyline.js');
const calculateDistance = require('./calculateDistance.js');
const getDistancesToStations = require('./getDistancesToStations.js');

// Fetch API in Node.js (Node 18+ has built-in fetch)
async function filteredChargingStations(req, res) {
    console.log('reached to station filter');
    console.log('Request body:', req.body);

    const { user,
        vehicleId,
        routeDistanceInKm,
        tripData,
        polyline,
        source } = req.body;
        
    if (!user || !user._id) {
        const errorMsg = 'User data is required - User object with _id is missing from request body';
        console.error('ERROR:', errorMsg);
        return res.status(400).json({ 
            error: 'User data is required',
            message: errorMsg
        });
    }

    const maxDistanceRelatedData = await estimateMaxDistance(
        user._id, 
        vehicleId ?? null, 
        tripData?.batteryLevel != null ? Number(tripData.batteryLevel) : 50,
        tripData?.passengers != null ? Number(tripData.passengers) : 1,
        tripData?.additionalWeightKg != null ? Number(tripData.additionalWeightKg) : 0
        ); // km buffer around polyline
    
    const distance = maxDistanceRelatedData.maxDistanceKm;
    const maxDistanceKm = maxDistanceRelatedData.maxDistanceKm;
    const distanceunit = 'km';
    console.log('distance unit: ', distance, distanceunit);
    
    // if the distance is short
    if( distance > routeDistanceInKm ){
        const surplusRange = distance - routeDistanceInKm;
        console.log('No need to charge the vehicle');
        return res.status(200).json({
            stations: [], // Empty array of stations
            meta: {
                needsCharging: false,
                message: 'You can reach the destination without charging your EV',
                routeDistance: routeDistanceInKm,
                vehicleRange: distance,
                surplusRange: surplusRange.toFixed(2)
            }
        });
    }

    const baseUrl = 'https://api.openchargemap.io/v3/poi';

    // Construct query params
    const queryParams = new URLSearchParams({
        polyline: polyline,
        distance: distance.toString(),
        distanceunit: distanceunit,
        output: 'json',
        countrycode: 'LK',
        maxresults: 20,
        compact: 'true',
        verbose: 'false',
        key: API_KEY,
        // client: 'myApp'
    });

    // Log the full URL before fetching
    const fullUrl = `${baseUrl}?${queryParams.toString()}`;
    console.log('Fetching URL:', fullUrl);

    try {
        const response = await fetch(fullUrl, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        let openChargeStations = await response.json();
        openChargeStations = openChargeStations.map(station => ({
            id: station.ID,
            title: station.AddressInfo?.Title || 'Charging Station',
            description: station.AddressInfo?.AddressLine1 || 'No description available',
            latitude: station.AddressInfo?.Latitude,
            longitude: station.AddressInfo?.Longitude,
            address: `${station.AddressInfo?.AddressLine1 || ''}, ${station.AddressInfo?.Town || ''}, ${station.AddressInfo?.StateOrProvince || ''}`.trim().replace(/^,|,$/g, ''),
            town: station.AddressInfo?.Town,
            postcode: station.AddressInfo?.Postcode,
            country: station.AddressInfo?.Country?.Title,
            operatorInfo: station.OperatorInfo,
            connections: station.Connections,
            usageType: station.UsageType,
            statusType: station.StatusType,
            numberOfPoints: station.NumberOfPoints,
            phone: station.AddressInfo?.ContactTelephone1,
            website: station.AddressInfo?.RelatedURL,
            isPartnered: false
        })).filter(station => station.latitude && station.longitude);

        //partnered charging stations fetch with distance filtering

        // Decode polyline to get route coordinates
        const routeCoordinates = decodePolyline(polyline);
        
        // Get partnered stations near the route
        const partneredStations = await getPartneredStationsNearRoute(routeCoordinates, distance);

        // Format partnered stations to match the structure
        const formattedPartneredStations = partneredStations.map(station => ({
            id: station._id.toString(),
            title: station.station_name || 'Charging Station',
            description: 'Partnered Station',
            latitude: station.location.latitude,
            longitude: station.location.longitude,
            address: station.address,
            town: station.city,
            isPartnered: true, // Flag to identify partnered stations
        }));

        // Combine both arrays
        let allStations = [...openChargeStations, ...formattedPartneredStations];
        
        console.log('Total stations before filtering:', allStations.length);
        console.log('OpenCharge stations before filtering:', openChargeStations.length);
        console.log('Partnered stations before filtering:', formattedPartneredStations.length);

        // ✅ GET ACTUAL DRIVING DISTANCES USING GOOGLE MAPS
        const startLat = source?.latitude;
        const startLng = source?.longitude;

        if (!startLat || !startLng) {
            return res.status(400).json({
                error: 'Source location is required',
                message: 'Please provide source latitude and longitude'
            });
        }

        console.log('Calculating distances from start to all stations...');
        const stationsWithDistances = await getDistancesToStations(
            startLat, 
            startLng, 
            allStations,
            process.env.GOOGLE_MAPS_API_KEY
        );

        // ✅ FILTER REACHABLE STATIONS
        // Apply 90% safety margin (leave 10% buffer for emergencies)
        const safetyMargin = 0.9;
        const maxReachableDistance = maxDistanceKm * safetyMargin;

        const reachableStations = stationsWithDistances
            .filter(item => item.distanceKm <= maxReachableDistance)
            .map(item => ({
                ...item.station,
                distanceFromStart: item.distanceKm.toFixed(2),
                distanceText: item.distanceText,
                durationText: item.durationText,
                isReachable: true
            }))
            .sort((a, b) => parseFloat(a.distanceFromStart) - parseFloat(b.distanceFromStart));

        console.log('Reachable stations:', reachableStations.length);
        console.log('Filtered out (unreachable):', allStations.length - reachableStations.length);

        return res.status(200).json({
            stations: reachableStations,
            meta: {
                needsCharging: true,
                count: reachableStations.length,
                totalFound: allStations.length,
                filtered: allStations.length - reachableStations.length,
                maxRange: maxDistanceKm,
                maxReachableDistance: maxReachableDistance.toFixed(2),
                safetyMargin: '90%'
            }
        });

    } catch (error) {
    console.error('Error fetching charging stations:', error);
    res.status(500).json({ 
        error: 'Failed to fetch charging stations',
        message: error.message,
        details: error.toString()
    });
    return [];
    }
}



async function getPartneredStationsNearRoute(routeCoordinates, maxDistance) {
    // Get all stations
    const allStations = await PartneredChargingStation.find({
        'location.latitude': { $exists: true, $ne: null },
        'location.longitude': { $exists: true, $ne: null }
    });
    
    const stationsNearRoute = new Set();
    
    // Sample every 10th point
    const sampledPoints = routeCoordinates.filter((_, index) => index % 10 === 0);
    
    // For each sampled point
    for (const point of sampledPoints) {
        // Check each station
        for (const station of allStations) {
            const distance = calculateDistance(
                point.latitude,
                point.longitude,
                station.location.latitude,
                station.location.longitude
            );
            
            if (distance <= maxDistance) {
                stationsNearRoute.add(station._id.toString());
            }
        }
    }
    
    // Fetch unique stations
    const stationIds = Array.from(stationsNearRoute);
    return await PartneredChargingStation.find({ _id: { $in: stationIds } });
}



module.exports = { filteredChargingStations };