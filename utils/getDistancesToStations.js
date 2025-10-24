const { get } = require("mongoose");

async function getDistancesToStations(startLat, startLng, stations, GOOGLE_MAPS_API_KEY) {
    console.log('inside getDistancesToStations...');
    if (!stations || stations.length === 0) {
        return [];
    }

    // Google Distance Matrix API allows up to 25 destinations per request
    const batchSize = 25;
    const results = [];

    for (let i = 0; i < stations.length; i += batchSize) {
        const batch = stations.slice(i, i + batchSize);
        
        // Create destinations string: "lat1,lng1|lat2,lng2|..."
        const destinations = batch
            .map(station => `${station.latitude},${station.longitude}`)
            .join('|');

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLat},${startLng}&destinations=${destinations}&mode=driving&units=metric&key=${GOOGLE_MAPS_API_KEY}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.rows && data.rows[0]) {
                const elements = data.rows[0].elements;
                
                batch.forEach((station, index) => {
                    const element = elements[index];
                    
                    if (element.status === 'OK') {
                        results.push({
                            station: station,
                            distanceKm: element.distance.value / 1000, // Convert meters to km
                            distanceText: element.distance.text,
                            durationText: element.duration.text
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching distances for batch:', error);
        }

        // Add small delay between requests to avoid rate limiting
        if (i + batchSize < stations.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}

module.exports = getDistancesToStations;