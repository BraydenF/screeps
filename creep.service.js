const config = require('config');
const utils = require('utils');

const TARGET_ROLE_COUNT = {
  HARVESTER: 2,
  DRONE: 1,
  UPGRADER: 1,
}

const DEFAULT_TRACKER_DATA = {
  creepCount: 0,
  droneCount: 0,
  _drones: {},
}

// todo: can dynamically determine cost, based on parts list
const kits = {
  default: { parts: [WORK, CARRY, MOVE], cost: 200 },
  advanced: { parts: [WORK, CARRY, CARRY, MOVE, MOVE], cost: 300 },
  'drone.v3': { parts: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 450 },
  'drone.v4': { parts: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 450 },
  agile: { parts: [WORK, CARRY, MOVE, MOVE, MOVE], cost: 300 },
  soldier: { parts: [ATTACK, MOVE, TOUGH], cost: 140 }, // todo: does this work as default soldier?
  medic: { parts: [HEAL, MOVE], cost: 300 } // todo: does a medic need energy?
}

const creepTracker = {
  data: DEFAULT_TRACKER_DATA,
  run: function() {
    const creeps = Game.creeps;

    creepTracker.data = DEFAULT_TRACKER_DATA;
    creepTracker.data.creepCount = Object.keys(Game.creeps).length;
    creepTracker.data.droneCount = Object.keys(Game.creeps).reduce((acc, c) => c.job === 'drone' ? acc = acc++ : acc, 0).length;

    const counters = {};

    creepTracker.data._drones = {};
    for(const name in creeps) {
      const creep = Game.creeps[name];
      creepTracker.data._drones[name] = creep.memory;

      if (creep.memory.job === '') {
        counters.freeLoaders++;
      } else {
        counters[creep.memory.job] = typeof counters[creep.memory.job] === 'number' ? ++counters[creep.memory.job] : 0;
      }
    }

    creepTracker.data = { ...counters, ...creepTracker.data };
    creepTracker.save();
  },
  save: function() {
    Memory.creepTracker = creepTracker.data;
  },
}

const creepService = {
  run: function() {
    const spawn = Game.spawns[config.INITIAL_SPAWN];

    // processes jobs for each worker; counts currently assigned roles
    creepTracker.run();

    // role service
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];

      if (utils.roll() > 96) {
        creep.say(utils.randomSay());
      }
    }
  }
};

module.exports = creepService;
