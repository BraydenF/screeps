const config = require('config');
const utils = require('utils');
const creepService = require('creep.service');
const droneService = require('drone.service');
const towerService = require('tower.service');
const spawnController = require('spawn.controller');
const roomController = require('room.controller');

/**
 * todo:
 * - finish Miner system
 * - create offensive creeps / automate defenses. 
 * - Re organize the code, things are cluttered.
 */
// will need different types of creeps: support killers, medics, simple soldiers.

const spawnsArray = [];

const consoleService = {
    init: function() {
    	// console commands
        global.creepService = creepService;

        // global.spawn = function(job, budget) {
        //     spawnQueue.pushJob({ job, budget });
        // }

        // short cuts
        global.createDrone = spawnController.createDrone;
    },
    run: function() {
    	consoleService.init();
    	if (Game.time % 5 === 0) {
            console.log('*****************************************************************');
            _.map(Game.spawns, (spawn) => {
                console.log(`<b>${spawn.name}'s energy:</b> ${spawn.room.energyAvailable} / ${spawn.room.energyCapacityAvailable}`);
                spawnController.spawnQueue.report();
            });
            console.log('*****************************************************************');
    	}
    }
}

// main logic loop
module.exports.loop = function () {
    // consoleService.run();

    function keys(obj) {
        return console.log('keys', Object.keys(obj));
    };

    // todo: multi room loop will soon be needed
    for(var room_it in Game.rooms) {
        const room = Game.rooms[room_it];
        const spawn = room.find(FIND_MY_SPAWNS)[0];
    }

    roomController.run();
    //towerService.run();
    creepService.run();
    // spawnController.run();
}

Array.prototype.rand = function() {
    const index = Math.floor(Math.random()*this.length);
    // console.log(`rand ${index} / this.length`);
    return this[index];
};
