const config = require('config');
const droneService = require('drone.service');
const towerService = require('tower.service');

const roomController = {
  /**
   * Handles logic for spawning units into the initial room
   */
  basicSpawn: function(room) {
    const sources = room.find(FIND_SOURCES);
    let creepToBuild;

    // ensures a harvester is assigned to each energy resource
    if (!room.memory.sources) room.memory.sources = {};
    sources.forEach(source => {
      if (typeof room.memory.sources[source.id] == 'number') {
        if (room.memory.sources[source.id] >= Game.time) {
          room.memory.sources[source.id] = null;
        }
      } else if (!creepToBuild) {
        creepToBuild = 'harvester';
        const result = droneService.createDrone(creepToBuild);
        if (result == OK) room.memory.sources[source.id] = Game.time + 1515;
      }
    });

    if (!creepToBuild && Memory.creepTracker.upgrader < 2) {
      creepToBuild = 'upgrader';
      droneService.createDrone(creepToBuild);
    }

    if (!creepToBuild && room.find(FIND_MY_CONSTRUCTION_SITES) && Memory.creepTracker.builder < 1) {
      creepToBuild = 'builder';
      droneService.createDrone(creepToBuild);
    }
  },
	run: function(room) {
    // todo: determine if this file is still useful
	}
};

module.exports = roomController;
