require('dotenv').config();

const API_KEY = process.env.OPEN_CHARGE_MAP_API_KEY;
const estimateBatteryConsumption = require('./batteryEstimator.js');

// Fetch API in Node.js (Node 18+ has built-in fetch)
async function filteredChargingStations() {
    const polyline = 'aaaaaaa'; // Replace with actual encoded polyline
    const distance = 10; // km buffer around polyline
    const distanceunit = 'km';

    const baseUrl = 'https://api.openchargemap.io/v3/poi';

    // Construct query params
    const queryParams = new URLSearchParams({
        // polyline: polyline,
        // distance: distance.toString(),
        // distanceunit: distanceunit,
        output: 'json',
        countrycode: 'LK',
        maxresults: '5',
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

        const stations = await response.json();
        console.log('stations: ', stations);
        res.status(200).json(stations);
        return stations;
    } catch (error) {
        console.error('Error fetching charging stations:', error);
        return [];
    }
}

module.exports = { filteredChargingStations };