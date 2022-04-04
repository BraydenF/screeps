const roleService = require('role.service');

const SPAWN_ZERO_NAME = 'colony_0';

const colonies = [
    Game.spawns[SPAWN_ZERO_NAME],
];

function init_console() {
    // console commands
    global.roleService = roleService;

    // short cuts
    global.createCreep = roleService.createCreep;
}

module.exports.loop = function () {
    init_console();
    // console.log('*****************************************************************');

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

    roleService.run();
}
