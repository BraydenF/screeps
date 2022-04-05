const roleService = require('role.service');
// const consoleService = require('console.service');
// const towerService = require('tower.service');

const SPAWN_ZERO_NAME = 'colony_0';

const colonies = [
    Game.spawns[SPAWN_ZERO_NAME],
];

// allows for expanding of the game console
const consoleService = {
    init: function() {
        // console commands
        global.roleService = roleService;

        // short cuts
        global.createCreep = roleService.createCreep;
    },
}

// main logic loop
module.exports.loop = function () {
    console.log('*****************************************************************');
    consoleService.init();

    function keys(obj) {
        return console.log('keys', Object.keys(obj));
    };

    // const randkey = '624b1b428545bf17e16f179d';

    // keys(Game.structures);
    // const structures = Game.structures;
    // console.log(structures[randkey]);

    // towerService.run();
    roleService.run();
}
