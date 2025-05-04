const config = require('config');
const droneService = require('drone.service');

const { INITIAL_SPAWN } = config;

class MiningTeam {
  constructor(spawn, target = null) {
    if (!Memory.miningTeam) {
      Memory.miningTeam = { target: target, miner: null, haulers: [] }; 
    }

    this.spawn = spawn;
    this.memory = Memory.miningTeam;
  }

  get(key) {
    return this.memory[key];
  }

  set(key, value) {
    this.memory[key] = value;
  }

  run() {
    this.handleMiner();
    this.handleHaulers();
  }

  spawnMiner() {
    if (!this.spawn.spawning && this.spawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      const result = droneService.createDrone('miner', this.spawn.room.energyCapacityAvailable);
      if (result.status == OK) {
        this.setMiner('miner', result.name);
        Memory.miningTeam.miner = result.name;
      }
    }
  }

  spawnHauler() {
    if (!this.spawn.spawning && this.spawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      const result = droneService.createDrone('hauler', this.spawn.room.energyCapacityAvailable);
      if (result.status == OK) {
        const updatedHaulers = this.get('haulers').push(result.name);
        this.set('haulers', updatedHaulers);
        Memory.miningTeam.haulers = updatedHaulers;
      }
    }
  }

  handleMiner() {
    const miner = this.spawn.room.find(FIND_MY_CREEPS, { filter: (creep) => creep.name == this.miner });

    if (this.miner && miner && miner[0]) {
      const memory = Memory.creeps[this.miner];

      if (miner && miner[0]) {
        if (memory.target != this.target) {
          memory.target = this.target;
        }

        if (miner[0].ticksToLive <= 500) {
          // enter repair mode
          miner[0].memory.task = 'recharge';
        }
      }
    }
  }

  handleHauler(haulerName) {
    const hauler = this.spawn.room.find(FIND_MY_CREEPS, {
      filter: (creep) => creep.name == haulerName
    });

    if (hauler && hauler[0]) {
      // manage the hauler
      const memory = Memory.creeps[haulerName];
      if (hauler[0].ticksToLive <= 500) {
        // enter repair mode
        hauler[0].memory.task = 'recharge';
      }
    }
  }

  handleHaulers() {
    for (let haulerName of this.get('haulers')) {
      this.handleHauler(haulerName);
    }
  }
}


const roomController = {
  /**
   * Handles logic for spawning units into the initial room
   */
  basicSpawn: function (room) {
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
  manageDroneTeam: function(room) {
    // todo: spawn and manage creeps building, upgrading, and repairing.
    // One upgrader should be active at a time, they can be assigned a container as their primary source of enery
  },
  handleInitialRoom: function() {
    const spawn = Game.spawns[INITIAL_SPAWN];
    const room = spawn.room;

    // roomController.basicSpawn(room);
    const miningTeam = new MiningTeam(spawn, '5bbcac6b9099fc012e6356cb');
    miningTeam.run();

    // miningTeam.spawnMiner();
    // miningTeam.spawnHauler();


    // const target = spawn.pos.findClosestByPath(FIND_MY_CREEPS);
    // console.log(target.name);
    // spawn.renewCreep(target);

    // droneService.createDrone('harvester');
    // droneService.createDrone('builder');
    // droneService.createDrone('upgrader', 550);

  },
	run: function(room) {
    roomController.handleInitialRoom();
	}
};

module.exports = roomController;
