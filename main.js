const creepService = require('creep.service');
const consoleService = require('console.service');
const towerService = require('tower.service');

// todo: create offensive creeps. 
// will need different types of creeps: support killers, medics, simple soldiers.


const spawnsArray = [];

// Game._spawns = {
//     console.log('test');
// }
// Game.spawns.prototype = function() {
//     // body... 
//     console.log('test')
//     console.log('this??', this);
// };

// main logic loop
module.exports.loop = function () {
    consoleService.run();

    function keys(obj) {
        return console.log('keys', Object.keys(obj));
    };

    // todo: multi room loop will soon be needed
    for(var room_it in Game.rooms) {
        const room = Game.rooms[room_it]
        const spawn = room.find(FIND_MY_SPAWNS)[0];
    }

    // todo: can I calculate the energy in/out rates?

    towerService.run();
    creepService.run();
}
