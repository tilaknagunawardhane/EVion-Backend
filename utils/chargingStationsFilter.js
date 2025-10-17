require('dotenv').config();

const API_KEY = process.env.OPEN_CHARGE_MAP_API_KEY;
const estimateBatteryConsumption = require('./batteryEstimator.js');

// Fetch API in Node.js (Node 18+ has built-in fetch)
async function filteredChargingStations(req, res) {
    console.log('reached to station filter');
    console.log('Request body:', req.body);

    const polyline = req.body.polyline;
    const distance = 10; // km buffer around polyline
    const distanceunit = 'km';

    const baseUrl = 'https://api.openchargemap.io/v3/poi';

    // Construct query params
    const queryParams = new URLSearchParams({
        polyline: polyline,
        distance: distance.toString(),
        distanceunit: distanceunit,
        output: 'json',
        countrycode: 'LK',
        maxresults: 5,
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

        let stations = await response.json();
        stations = stations.map(station => ({
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
            website: station.AddressInfo?.RelatedURL
        })).filter(station => station.latitude && station.longitude);

        console.log('stations: ', stations);
        res.status(200).json(stations);
        return stations;
    } catch (error) {
        console.error('Error fetching charging stations:', error);
        return [];
    }
}

module.exports = { filteredChargingStations };