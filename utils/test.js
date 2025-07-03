const estimateBatteryConsumption = require('./batteryEstimator');

const result = estimateBatteryConsumption(
    'Tesla Model 3',
    90,
    150,
    75
)

console.log('Battery Consumption Estimate: ', result);