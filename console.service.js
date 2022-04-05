const roleService = require('role.service');

// allows for expanding of the game console
const consoleService = {
    init: function() {
    // console commands
        global.roleService = roleService;
    
        // short cuts
        global.createCreep = roleService.createCreep;
    },
}

modules.exports = consoleService;
