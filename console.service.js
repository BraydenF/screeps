const creepService = require('creep.service');
const droneService = require('drone.service');

// allows for expanding of the game console
const consoleService = {
    init: function() {
    // console commands
        global.creepService = creepService;

        // short cuts
        global.createCreep = creepService.createCreep;
        global.createDrone = droneService.createDrone;
    },
}

module.exports = consoleService;
