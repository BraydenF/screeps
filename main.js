const config = require('config');
const utils = require('utils');
const creepService = require('creep.service');
const Hive = require('Hive');
const Drone = require('Drone.class');

/**
 * todo:
 * - create offensive creeps / automate defenses. 
 * - Re organize the code, things are cluttered.
 */
const consoleService = {
    init: function() {
    	// console commands
        global.creepService = creepService;

        // global.spawn = function(job, budget) {
        //     spawnQueue.pushJob({ job, budget });
        // }

        // short cuts
        // global.createDrone = spawnController.createDrone;
    },
    run: function() {
    	consoleService.init();
    	if (Game.time % 5 === 0) {
            console.log('*****************************************************************');
            _.map(Game.spawns, (spawn) => {
                console.log(`<b>${spawn.name}'s energy:</b> ${spawn.room.energyAvailable} / ${spawn.room.energyCapacityAvailable}`);
                // spawnController.spawnQueue.report();
            });
            console.log('*****************************************************************');
    	}
    }
}

// main logic loop
module.exports.loop = function () {
  consoleService.run();

  function keys(obj) {
    return console.log('keys', Object.keys(obj));
  };

  // todo: multi room loop will soon be needed
  for (var room_it in Game.rooms) {
    const room = Game.rooms[room_it];
    const spawn = room.find(FIND_MY_SPAWNS)[0];
  }

  try {
    const hive1 = new Hive('Spawn1');
    hive1.run();
  } catch (e) {
    console.log('hive1:', e.message);
  }

  try {
    const hive2 = new Hive('Spawn2');
    hive2.run();
  } catch (e) {
    console.log('hive2:', e.message);
  }

  Drone.getDrones().forEach(drone => drone.run());

  creepService.run();
}

Array.prototype.rand = function() {
    const index = Math.floor(Math.random()*this.length);
    // console.log(`rand ${index} / this.length`);
    return this[index];
};
