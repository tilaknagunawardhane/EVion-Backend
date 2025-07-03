//efficiency => kWh per 1km
//batteryCapacity => kWh
//weight => kg

const vehicleData = {
  'Tesla Model 3': { efficiency: 0.149, batteryCapacity: 75, weight: 1800, type: 'sedan' },
  'Ford Mustang Mach-E': { efficiency: 0.20, batteryCapacity: 88, weight: 2200, type: 'suv' }, 
  'Nissan Leaf': { efficiency: 0.17, batteryCapacity: 40, weight: 1500, type: 'compact' }, 
};

module.exports = { vehicleData };