const {vehicleData} = require('./vehicleData');
/**
 * Estimates battery consumption for an EV trip.
 * 
 * @param {string} vehicleName - Make and model of the vehicle with other data
 * @param {number} initialBatteryLevelPercent - Starting battery level (0–100)
 * @param {number} distanceKm - Distance to travel in km
 * @param {number} batteryCapacityKWh - Total usable battery capacity
 * @returns {object} Battery usage info
 */

function estimateBatteryConsumption(vehicleName, initialBatteryLevelPercent, distanceKm, passengerCount = 1, additionalWeightKg = 0){
    const vehicle = vehicleData[vehicleName];
    console.log('vehicle: ', vehicle);

    const { efficiency, batteryCapacityKWh, vehicleWeightKg } = vehicle ;
    console.log(batteryCapacityKWh, efficiency, vehicleWeightKg);

    if(!vehicle || !Number.isFinite(efficiency) || !Number.isFinite(batteryCapacityKWh) || !Number.isFinite(vehicleWeightKg) || efficiency <=0 || batteryCapacityKWh <=0 || vehicleWeightKg <=0 ){
        throw new Error(`Invalid vehicle data (${vehicleName})`);
    }

    if(!Number.isFinite(initialBatteryLevelPercent) || initialBatteryLevelPercent < 0 || initialBatteryLevelPercent > 100) {
        throw new Error("Initial battery level must be a number between 0 and 100");
    }
    if(!Number.isFinite(distanceKm) || distanceKm < 0) {
        throw new Error("Distance must be a non-negative number");
    }
    if(!Number.isFinite(passengerCount) || passengerCount < 0){
        throw new Error("Passenger count must be non negative");
    }
    if(!Number.isFinite(additionalWeightKg) || additionalWeightKg < 0){
        throw new Error("Additional weight must be non negative");
    }

    const avgPassengerWeightKg = 75;
    const totalWeightKg = vehicleWeightKg + (avgPassengerWeightKg * passengerCount) + additionalWeightKg;

    const adjustedEfficiency = efficiency * (totalWeightKg / vehicleWeightKg);  //efficiency adjustment considering the weight with a linear approximation
    console.log('efficiency: ', efficiency, '\nadjust efficiency: ', adjustedEfficiency ); 

    const batteryUsedKWh = adjustedEfficiency * distanceKm;
    const batteryUsedPercent = batteryUsedKWh / batteryCapacityKWh * 100;
    const batteryRemainingPercent = Math.max(initialBatteryLevelPercent - batteryUsedPercent, 0);

    return{
        distanceKm: distanceKm.toFixed(2),
        batteryUsedKWh: batteryUsedKWh.toFixed(2),
        batteryUsedPercent: batteryUsedPercent.toFixed(2),
        batteryRemainingPercent: batteryRemainingPercent.toFixed(2),
        totalWeightKg: totalWeightKg.toFixed(2),
        adjustedEfficiency: adjustedEfficiency.toFixed(3),
        isTripFeasible: batteryRemainingPercent > 0
    };
}
module.exports = estimateBatteryConsumption;