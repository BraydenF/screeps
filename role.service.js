const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleDrone = require('role.drone');
const utils = require('utils');
const { randomSay } = require('fun');

const TARGET_ROLE_COUNT = {
    HARVESTER: 2,
    BUILDER: 1,
    UPGRADER: 1,
}

// todo: can dynamically determine cost, based on parts list
// todo: I need to get another work unit on my creeps quickly
const kits = {
    default: { parts: [WORK, CARRY, MOVE], cost: 200 },
    advanced: { parts: [WORK, CARRY, CARRY, MOVE, MOVE], cost: 300 },
    'drone.v3': { parts: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 450 },
    agile: { parts: [WORK, CARRY, MOVE, MOVE, MOVE], cost: 300 },
    soldier: { parts: [ATTACK, MOVE, TOUGH], cost: 140 }, // todo: does this work as default soldier?
    medic: { parts: [HEAL, MOVE], cost: 300 } // todo: does a medic need energy?
}

const creepBuilder = {
    
}

/**
 * Ideas for roles
 * 
 * Drone: A generic worker role that balances itself between (harvesting, build, repairing, and upgrading)
 * 
 * Road Builder:  Takes on the harvester role and records path to return energy.
 *                Then builds a road along the path. (unsure if something like this is needed)
 * 
 * Medic: Rather obvious, just needs to be created.
 * 
 * How can existing roles be advanced? Can I set up storages or distribution routes?
 * 
 * others??
 * 
 */
const roleService = {
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
    shiftPlanning: function() {
        // todo: create a function that shifts workers between roles.
        // No builders needed, if nothing being built
        // likely target 2 harvesters per node
        // always 1 or 2 upgraders? Can I determine my enegery rates?

        if (Game.constructionSites.length > 0) {
            // todo: switch on builders
        } else {
            // todo: switch off building
        }
    },
    run: function() {
        const spawn = Game.spawns['spawn'];

        const creepTracker = {
            names: [],
            droneCount: 0,
            harvesterCount: 0,
            upgraderCount: 0,
            builderCount: 0,
        }

        // processes jobs for each worker; counts currently assigned roles
        for(const name in Game.creeps) {
            const creep = Game.creeps[name];
            creepTracker.names.push(name);

            if (utils.roll() > 90) {
                creep.say(randomSay());
            }

            if (creep.memory.role === 'drone' || creep.memory.role === 'beta') {
                roleDrone.run(creep);
            }

            if (creep.memory.role == 'harvester') {
                roleHarvester.run(creep);

                creepTracker.harvesterCount++;
                creepTracker.droneCount++;
            } else if(creep.memory.role == 'upgrader') {
                roleUpgrader.run(creep);

                creepTracker.upgraderCount++;
                creepTracker.droneCount++;
            } else if(creep.memory.role == 'builder') {
                roleBuilder.run(creep);

                creepTracker.builderCount++;
                creepTracker.droneCount++;
            }
        }

        Game.spawns['spawn'].memory.creepTracker = creepTracker

        // console.log(spawn.room.energyAvailable, spawn.room.energyAvailable >= 300);
        // todo: create a build queue that I can manage manually

        console.log(spawn.room.energyAvailable, '/', 450);

        // failsafe to create a harvester if we run out of workers
        if (creepTracker.droneCount === 0) {
            notify('Emergency harvester creater');
            roleService.createCreep('harvester', spawn.room.energyAvailable >= 300 ? 'advanced' : 'default');
        }

        // currently only spawns advanced creeps
        if (spawn.room.energyAvailable >= 450) {
            if (creepTracker.harvesterCount < 2) {
                console.log('spawning harvester');
                roleService.createCreep('harvester', 'drone.v3');
            } else if (creepTracker.upgraderCount === 0) {
                console.log('spawning upgrader');
                roleService.createCreep('upgrader', 'drone.v3');
            } else if (Game.constructionSites.length > 0 && creepTracker.builderCount < 2) {
                console.log('spawning builder');
                roleService.createCreep('builder', 'drone.v3');
            }
        }
    },
};

module.exports = roleService;
