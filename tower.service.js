// tower management system
const towerService = {
    run: function() {
        // todo: does this need to be supplied with a tower ID that is real? Does that make sense?
        const tower = Game.getObjectById('TOWER_ID');

        if(tower) {
            const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax
            });

            if(closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            }

            const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(closestHostile) {
                tower.attack(closestHostile);
            }
        }
    }
}

modules.exports = towerService;
