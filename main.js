const creepService = require('creep.service');
const consoleService = require('console.service');
const towerService = require('tower.service');

// todo: create offensive creeps. 
// will need different types of creeps: support killers, medics, simple soldiers.

// main logic loop
module.exports.loop = function () {
    const spawn = Game.spawns['spawn'];
    console.log('*****************************************************************');
    console.log('<b>energy:</b>', spawn.room.energyAvailable, '/', spawn.room.energyCapacityAvailable);
    consoleService.init();

    function keys(obj) {
        return console.log('keys', Object.keys(obj));
    };

    // todo: can I calculate the energy in/out rates?

    towerService.run();
    creepService.run();
}
