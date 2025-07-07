const estimateBatteryConsumption = require('./batteryEstimator');

const result = estimateBatteryConsumption(
    vehicleName = 'Tesla Model 3',
    initialBatteryLevelPercent = 90,
    distanceKm = 150,
    passengerCount = 3,
    additionalWeightKg = 100
)

console.log('Battery Consumption Estimate: ', result);