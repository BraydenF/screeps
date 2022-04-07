const creepService = require('creep.service');
const consoleService = require('console.service');
// const towerService = require('tower.service');

// main logic loop
module.exports.loop = function () {
    const spawn = Game.spawns['spawn'];
    console.log('*****************************************************************');
    console.log('energy:', spawn.room.energyAvailable, '/', spawn.room.energyCapacityAvailable);
    consoleService.init();

    function keys(obj) {
        return console.log('keys', Object.keys(obj));
    };

    // towerService.run();
    creepService.run();
}
