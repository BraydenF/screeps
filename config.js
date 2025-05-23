const config = {
    INITIAL_SPAWN: 'Spawn1',
    SPAWN_MODES: {
        INITAL_SPAWN_MODE: 'intial_spawn_mode',
        MAINTENANCE_MOD: 'maintenance_mode',
    },
    DRONE_LIMIT: 5,
    MINERS_ENABLED: false,
    MODES: {
        STANDBY: 'standby',
        HARVEST: 'harvest',
        WITHDRAW: 'withdraw',
        UPGRADE: 'upgrade',
    },
    JOBS: {
        HARVESTER: 'harvester',
        UPGRADER: 'upgrader',
        BUILDER: 'builder',
        MECHANIC: 'mechanic',
        MINER: 'miner',
        HAULER: 'hauler',
        NONE: 'none',
    },
    roomsToAvoid: ['W9N451', 'W7N49', 'W9N49', 'W9N53'],
};

Game.config = config;

module.exports = config;
