const {vehicleData} = require('./vehicleData');
/**
 * Estimates battery consumption for an EV trip.
 * 
 * @param {string} vehicleName - Make and model of the vehicle
 * @param {number} initialBatteryLevelPercent - Starting battery level (0–100)
 * @param {number} distanceKm - Distance to travel in km
 * @param {number} batteryCapacityKWh - Total usable battery capacity
 * @returns {object} Battery usage info
 */

function estimateBatteryConsumption(vehicleName, initialBatteryLevelPercent, distanceKm, batteryCapacityKWh=0){
    const vehicle = vehicleData[vehicleName];
    console.log('vehicle: ', vehicleData);

    if(!vehicle){
        throw new Error(`Unknown vehicle type (${vehicle})`);
    }
    const efficiency = vehicle['efficiency'];
    batteryCapacityKWh = (batteryCapacityKWh==0)? vehicle.batteryCapacity : batteryCapacityKWh; 
    // console.log(batteryCapacityKWh);

    const batteryUsedKWh = efficiency * distanceKm;
    const batteryUsedPercent = batteryUsedKWh / batteryCapacityKWh * 100;
    const batteryRemainingPercent = Math.max(initialBatteryLevelPercent - batteryUsedPercent, 0);

    return{
        distanceKm,
        batteryUsedKWh: batteryUsedKWh.toFixed(2),
        batteryUsedPercent: batteryUsedPercent.toFixed(2),
        batteryRemainingPercent: batteryRemainingPercent.toFixed(2),
    };
}
module.exports = estimateBatteryConsumption;