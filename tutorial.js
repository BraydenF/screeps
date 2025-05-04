const utils = require('utils');
const spawn = Game.spawns['spawn'];

/**
 * Make updates to be able to run these tasks as its own system similar to drones. 
 */
const tutorialService = {
    getRandomSource: function(sources) {
        const target = sources[utils.roll() < 50 ? 1 : 0];
        return target.id;
    },
    creepIsFull: function(creep) {
        return creep.store.getFreeCapacity() === 0;
    },
    run: function() {
        
    }
}

function getRandomSource(sources) {
    const target = sources[utils.roll() < 50 ? 1 : 0];
    return target.id;
}

function creepIsFull(creep) {
    return creep.store.getFreeCapacity() === 0;
}

const roleHarvester = {
    create: function(kitName = 'default') {
        const kit = typeof kits[kitName] !== 'undefined' ? kits[kitName] : kits.default;
        return spawn.createCreep(kit, null, { role: 'harvester' });
    },
    /** @param {Creep} creep **/
    run: function(creep) {
        // console.log(creep.name, 'is targeting source', creep.memory.target);
        // creep.memory.target = undefined // clears all targets
        if (!creep.memory.target) {
            var sources = creep.room.find(FIND_SOURCES);
            const target = sources[utils.roll() < 50 ? 1 : 0];
            creep.memory.target = target.id;
        }

        if(creep.store.getFreeCapacity() > 0) {
            const target = Game.getObjectById(creep.memory.target);
            if(creep.harvest(target) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else {
            function findEmptyStorages() {
                return creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER ||
                                structure.structureType == STRUCTURE_CONTAINER
                            ) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
            }

            var targets = findEmptyStorages();
            console.log('targets', targets);

            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }
    }
};

const roleUpgrader = {
    create: function() {
      return Game.spawns['spawn'].createCreep([WORK, CARRY, MOVE], null, { role: 'upgrader' });
    },
    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.upgrading = false;
            creep.say('🔄 harvest');
        }

        if(!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
            creep.memory.upgrading = true;
            creep.say('⚡ upgrade');
        }

        if(creep.memory.upgrading) {
            if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            const sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0], { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
};


const roleBuilder = {
    create: function() {
      return Game.spawns['spawn'].createCreep([WORK, CARRY, MOVE], null, { role: 'builder' });
    },
    /** @param {Creep} creep **/
    run: function(creep) {

        function isEnergyEmpty() {
            return creep.store[RESOURCE_ENERGY] == 0
        }

        function isEnergyFull(creep) {
            return creep.store.getFreeCapacity() == 0
        }

        // fetching engery
        // todo: figure out how to take energy from storage
        if (creep.memory.building && isEnergyEmpty(creep)) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
        }
        // creep.store.getFreeCapacity()

        if (!creep.memory.building && isEnergyFull(creep)) {
            creep.memory.building = true;
            creep.say('🚧 build');
        }

        if (creep.memory.building) {
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (targets.length) {
                if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        } else {
            const sources = creep.room.find(FIND_SOURCES);
            // console.log(creep.name, 'is targeting source', creep.memory.target_source);
            // creep.memory.target = undefined // clears all targets
            if (!creep.memory.target_source) {
                console.log('Builder is targeting');
                creep.memory.target_source = getRandomSource(sources);
            }

            const target_source = Game.getObjectById(creep.memory.target_source);
            if (creep.harvest(target_source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target_source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
};

module.exports = roleHarvester;
module.exports = roleBuilder;
module.exports = roleUpgrader;
module.exports = tutorialService;
