const config = require('config');
const utils = require('utils');

const DEFAULT_TRACKER_DATA = {
  creepCount: 0,
  droneCount: 0,
  _drones: {},
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
