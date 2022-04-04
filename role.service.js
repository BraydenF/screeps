const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const utils = require('utils');

const TARGET_ROLE_COUNT = {
    HARVESTER: 2,
    BUILDER: 1,
    UPGRADER: 1,
}

const kits = {
    default: { parts: [WORK, CARRY, MOVE], cost: 200 },
    advanced: { parts: [WORK, CARRY, CARRY, MOVE, MOVE], cost: 300 },
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
    },
    run: function() {
        const spawn = Game.spawns['spawn'];

        const workerCounts = {
            harvester: 0,
            upgrader: 0,
            builder: 0,
        }

        // processes jobs for each worker; counts currently assigned roles
        for(const name in Game.creeps) {
            const creep = Game.creeps[name];

            if (utils.roll() === 0) {
                creep.say('booya');
            }

            if (creep.memory.role == 'harvester') {
                roleHarvester.run(creep);
                workerCounts.harvester++;
            } else if(creep.memory.role == 'upgrader') {
                roleUpgrader.run(creep);
                workerCounts.upgrader++;
            } else if(creep.memory.role == 'builder') {
                roleBuilder.run(creep);
                workerCounts.builder++;
            }
        }

        // console.log(spawn.room.energyAvailable, spawn.room.energyAvailable >= 300);
        if (spawn.room.energyAvailable >= 300) {
            // managed number of each unit over time
            if (workerCounts.harvester < 2) {
                console.log('spawning harvester');
                roleService.createCreep('harvester', 'advanced');
            } else if (workerCounts.upgrader === 0) {
                console.log('spawning upgrader');
                roleService.createCreep('upgrader', 'advanced');
            } else if (Game.constructionSites.length > 0 && workerCounts.builder === 0) {
                console.log('spawning builder');
                roleService.createCreep('builder', 'advanced');
            }
        
        }
    },
};

module.exports = roleService;
