const creepService = require('creep.service');
const droneService = require('drone.service');
const _ = require('lodash');

// allows for expanding of the game console
const consoleService = {
    init: function() {
    	// console commands
        global.creepService = creepService;

        // short cuts
        global.createCreep = creepService.createCreep;
        global.createDrone = droneService.createDrone;
    },
    run: function() {
    	consoleService.init();
        console.log('*****************************************************************');
        _.map(Game.spawns, (spawn) => {
            console.log(`<b>${spawn.name}\'s energy:</b>`, spawn.room.energyAvailable, '/', spawn.room.energyCapacityAvailable);
        });
    }
}

module.exports = consoleService;
