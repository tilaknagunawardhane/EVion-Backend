//efficiency => kWh per 1km
//batteryCapacity => kWh
//weight => kg

const vehicleData = {
  'Tesla Model 3': { efficiency: 0.149, batteryCapacityKWh: 75, vehicleWeightKg: 1800, type: 'sedan' },
  'Ford Mustang Mach-E': { efficiency: 0.20, batteryCapacityKWh: 88, vehicleWeightKg: 2200, type: 'suv' }, 
  'Nissan Leaf': { efficiency: 0.17, batteryCapacityKWh: 40, vehicleWeightKg: 1500, type: 'compact' },
  'missingEfficiency': {batteryCapacityKWh: 40, vehicleWeightKg: 1500, type: 'compact' },
};

module.exports = { vehicleData };