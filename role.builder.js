const utils = require('utils');

function getRandomSource(sources) {
    const target = sources[utils.roll() < 50 ? 1 : 0];
    return target.id;
}

const roleBuilder = {
    create: function() {
      return Game.spawns['spawn'].createCreep([WORK, CARRY, MOVE], null, { role: 'builder' });
    },

    /** @param {Creep} creep **/
    run: function(creep) {

        // fetching engery
        // todo: figure out how to take energy from storage
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
        }

        if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
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

module.exports = roleBuilder;