
const utils = {
    roll: function() {
        return Math.floor(Math.random() * 100);
    },
    getRandomSource: function (sources) {
        const target = [utils.roll() < 50 ? 1 : 0];
        return target.id;
    },
    findResourceTargets(creep, resourceAmount = 0) {
        return creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN) &&
                    structure.store[RESOURCE_ENERGY] >= resourceAmount
            }
        });
    },
};

module.exports = utils;
