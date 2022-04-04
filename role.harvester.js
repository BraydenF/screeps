const utils = require('utils');
const spawn = Game.spawns['spawn'];

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
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }
    }
};

module.exports = roleHarvester;
