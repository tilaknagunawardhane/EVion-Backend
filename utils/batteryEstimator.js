
const EvOwner = require('../models/evOwnerModel');
/**
 * Estimates battery consumption for an EV trip.
 * 
 * @param {string} vehicleName - Make and model of the vehicle with other data
 * @param {number} initialBatteryLevelPercent - Starting battery level (0–100)
 * @param {number} distanceKm - Distance to travel in km
 * @param {number} batteryCapacityKWh - Total usable battery capacity
 * @returns {object} Battery usage info
 */

async function estimateBatteryConsumption(evOwnerId, vehicleId, initialBatteryLevelPercent = 100, distanceKm, passengerCount = 1, additionalWeightKg = 0){
    const evOwner = await EvOwner.findById(evOwnerId);
    if (!evOwner) {
        return {
            success: false,
            message: 'EV Owner not found'
        };
    }

    const vehicle = evOwner.vehicles.id(vehicleId) || evOwner.vehicles[0];
    
    if (!vehicle) {
        return {
            success: false,
            message: 'Vehicle not found'
        };
    }
    
    console.log('vehicle: ', vehicle);
    const efficiency = vehicle.efficiency ?? 0.2;
    const batteryCapacityKWh = vehicle.battery_capacity;
    const vehicleWeightKg = vehicle.vehicleWeightKg ?? 1500;
    // console.log(batteryCapacityKWh, efficiency, vehicleWeightKg);

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

async function estimateMaxDistance(evOwnerId, vehicleId, initialBatteryLevelPercent = 50, passengerCount = 1, additionalWeightKg = 0) {
    console.log('evOwnerId: ', evOwnerId);
    console.log('vehicleId: ', vehicleId);
    console.log('initialBatteryLevelPercent: ', initialBatteryLevelPercent);
    console.log('passengerCount: ', passengerCount);
    console.log('additionalWeightKg: ', additionalWeightKg);

    const evOwner = await EvOwner.findById(evOwnerId);
    if (!evOwner) {
        return {
            success: false,
            message: 'EV Owner not found'
        };
    }

    const vehicle = evOwner.vehicles.id(vehicleId) || evOwner.vehicles[0];

    if (!vehicle) {
        return {
            success: false,
            message: 'Vehicle not found'
        };
    }
    
    console.log('vehicle: ', vehicle);
    const efficiency = vehicle.efficiency ?? 0.2;
    const batteryCapacityKWh = vehicle.battery_capacity ?? 50;
    const vehicleWeightKg = vehicle.vehicleWeightKg ?? 1500;

    if(!vehicle || !Number.isFinite(efficiency) || !Number.isFinite(batteryCapacityKWh) || !Number.isFinite(vehicleWeightKg) || efficiency <= 0 || batteryCapacityKWh <= 0 || vehicleWeightKg <= 0) {
        throw new Error(`Invalid vehicle data`);
    }

    if(!Number.isFinite(initialBatteryLevelPercent) || initialBatteryLevelPercent < 0 || initialBatteryLevelPercent > 100) {
        throw new Error("Initial battery level must be a number between 0 and 100");
    }
    if(!Number.isFinite(passengerCount) || passengerCount < 0) {
        throw new Error("Passenger count must be non negative");
    }
    if(!Number.isFinite(additionalWeightKg) || additionalWeightKg < 0) {
        throw new Error("Additional weight must be non negative");
    }

    const avgPassengerWeightKg = 75;
    const totalWeightKg = vehicleWeightKg + (avgPassengerWeightKg * passengerCount) + additionalWeightKg;

    // Adjust efficiency based on weight
    const adjustedEfficiency = efficiency * (totalWeightKg / vehicleWeightKg);
    console.log('efficiency: ', efficiency, '\nadjusted efficiency: ', adjustedEfficiency);

    // Calculate available battery energy
    const availableBatteryKWh = (initialBatteryLevelPercent / 100) * batteryCapacityKWh;
    console.log('availableBatteryKWh: ', availableBatteryKWh);
    
    // Calculate maximum distance: distance = energy / efficiency
    const maxDistanceKm = availableBatteryKWh / adjustedEfficiency;
    console.log('maxDistanceKm: ', maxDistanceKm);

    return {
        maxDistanceKm: maxDistanceKm.toFixed(2),
        availableBatteryKWh: availableBatteryKWh.toFixed(2),
        initialBatteryLevelPercent: initialBatteryLevelPercent.toFixed(2),
        totalWeightKg: totalWeightKg.toFixed(2),
        adjustedEfficiency: adjustedEfficiency.toFixed(3),
        batteryCapacityKWh: batteryCapacityKWh.toFixed(2)
    };
}

module.exports = {estimateBatteryConsumption, estimateMaxDistance};