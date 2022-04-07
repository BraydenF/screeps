// const roleHarvester = require('role.harvester');
// const roleUpgrader = require('role.upgrader');
const droneService = require('drone.service');
const utils = require('utils');
const { randomSay } = require('fun');

const TARGET_ROLE_COUNT = {
    HARVESTER: 2,
    DRONE: 1,
    UPGRADER: 1,
}

// todo: can dynamically determine cost, based on parts list
// todo: I need to get another work unit on my creeps quickly
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
    data: {
        creepCount: 0,
        droneCount: 0,
        _drones: {},
    },
    run: function() {
        const creeps = Game.creeps;
        creepTracker.data.creepCount = Object.keys(Game.creeps).length;
        creepTracker.data.droneCount = Object.keys(Game.creeps).reduce((acc, c) => c.job === 'drone' ? acc = acc++ : acc, 0).length;

        const counters = {
            harvesters: 0,
            upgraders: 0,
            builders: 0,
            // mechanics: 0,
            // freeLoaders: 0,
        };

        for(const name in creeps) {
            const creep = Game.creeps[name];
            creepTracker.data._drones[name] = creep.memory;

            if (creep.memory.job === 'harvester') {
                counters.harvesters++;
            } else if (creep.memory.job === 'upgrader') {
                counters.upgraders++;
            } else if (creep.memory.job === 'builder') {
                counters.builders++;
            } else if (creep.memory.job === 'mechanic') {
                counters.mechanics++;
            } else {
                counters.freeLoaders++;
            }
        }

        creepTracker.data = { ...counters, ...creepTracker.data };
        creepTracker.save();
    },
    save: function() {
        Memory.creepTracker = creepTracker.data;
    },
}

class Creep {
    constructor(creep) {
        const memory = creep.memory || {};
        this.creep = creep;
        this.mode = memory.mode ? memory.mode : 'standby';
    }

    get(key) {
        return this.creep.memory[key];
    }

    set(key, value) {
        this.key = value;
        this.creep.memory[key] = value;
    }

    isMode(mode) {
        return this.mode === mode;
    }

    setMode(mode, message = null) {
        if (message) this.creep.say(message);
        this.set('mode', mode);
    }

    isStandby() {
        return !this.mode || this.isMode('standby');
    }

    clearMemory() {
        this.creep.memory = {};
    }
}

/**
 * Ideas for roles
 * 
 * Road Builder:  Takes on the harvester role and records path to return energy.
 *                Then builds a road along the path. (unsure if something like this is needed)
 * 
 * Medic: Rather obvious, just needs to be created.
 * 
 * How can existing roles be advanced? Can I set up storages or distribution routes?
 * 
 * others??
 */
const creepService = {
    createCreep: function(role = 'harvester', kitName) {
        const kit = typeof kits[kitName] !== 'undefined' ? kits[kitName] : kits.default;
        const energyAvailable = Game.spawns['spawn'].room.energyAvailable;

        if (energyAvailable >= kit.cost) {
            return Game.spawns['spawn'].createCreep(kit.parts, null, { role: role });
        } else {
            console.log(`Insufficent stored energy: ${energyAvailable}/${kit.cost}`);
            return false;
        }
    },
    run: function() {
        const spawn = Game.spawns['spawn'];

        // processes jobs for each worker; counts currently assigned roles
        creepTracker.run();
        droneService.run();

        // role service
        for(const name in Game.creeps) {
            const creep = Game.creeps[name];

            if (utils.roll() > 90) {
                creep.say(randomSay());
            }

            // backup modules for creeps
            // if (creep.memory.role == 'harvester') {
            //     roleHarvester.run(creep);
            // } else if(creep.memory.role == 'upgrader') {
            //     roleUpgrader.run(creep);
            // }
        }

        // todo: create a build queue that I can manage manually
    }
};

module.exports = creepService;
