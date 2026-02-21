global.ALL_SHARDS = ['shard0', 'shard1', 'shard2', 'shard3'];

const config = {
  INITIAL_SPAWN: 'Spawn1',
  SPAWN_MODES: {
    INITAL_SPAWN_MODE: 'intial_spawn_mode',
    MAINTENANCE_MOD: 'maintenance_mode',
  },
  DRONE_LIMIT: 5,
  JOBS: {
    HARVESTER: 'harvester',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    MECHANIC: 'mechanic',
    MINER: 'miner',
    HAULER: 'hauler',
    DRONE: 'drone',
  },
    // moveToOpts: { reusePath: 20, maxOps: 2000, ignoreCreeps: false, visualizePathStyle: { stroke: '#ffffff' } },
  moveToOpts: {
    reusePath: 15,
    visualizePathStyle: {
      stroke: '#ffffff',
      // strokeWidth: 0.25,
      // opacity: 0.55,
      // lineStyle: 'dashed'
    },
    plainCost: 2,
    swampCost: 5,
    // ignoreCreeps: true,
    maxOps: 5000,
  },
  roomsToAvoid: {
    shard1: ['E3N51', 'E9N51'],
    shard2: [],
    shard3: ['W9N51', 'W8N51', 'W4N51', 'W1N51', 'W1N54', 'E9N51', 'E9N54', 'E6N52', 'E7N53', 'E9N58', 'E14N41', 'E15N41', 'W9N52', 'E5N51', 'E5N56', 'E1N51'], // , 'W8N54'
  },
  rooms: {
    W8N53: {
      nickname: null,
          // observerRooms: ['W10N50', 'W10N55'],
    },
    W7N52: {
      nickname: null,
      observerRooms: ['W8N50', 'W7N50', 'W6N50', 'W5N50', 'W4N50'],
    },
    W2N54: {
      nickname: null,
      observerRooms: ['W3N50', 'W2N50', 'W1N50', 'W0N53', 'E0N51', 'E0N52', 'E0N53', 'E0N54'],
    },
    E8N56: {
      nickname: null,
      observerRooms: ['E10N59', 'E10N58', 'E10N57', 'E10N56', 'E10N55', 'E10N54', 'E10N53', 'E10N52'],
    },
    E7N51: {
      nickname: null,
      observerRooms: ['E4N50', 'E5N50', 'E6N50', 'E7N50', 'E8N50', 'E9N50', 'E10N50'], // 'E3N50', 
    },
    W9N55: {
      nickname: null,
      observerRooms: ['W10N54', 'W10N55', 'W10N56', 'W10N57'], // 'W10N53'
    },
  },
  signs: [
    'Be like Jasper, write your own code!',
    'boop',
  ],
};

 /**
  *    
  * 
  * global.Spawn7.createDrone('soldier', [MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK], {targetRoom:'E14N48', target:'68ddb5fac23a9d66f08f0ec3'})
  * 
  * 
  * global.Spawn7.createDrone('flagbearer', [MOVE,CLAIM,MOVE],{targetRoom:'E14N48',target:'5bbcadb99099fc012e637b50'})
  * global.Spawn7.createDrone('miner', [WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE], {targetRoom:'E14N48', source: 'source'});
  * global.Spawn7.createDrone('drone', [WORK,WORK,WORK,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY], {homeRoom:'E14N48',targetRoom:'E14N48'});
  * 
  * global.Spawn8.createDrone('drone', [WORK,WORK,MOVE,MOVE,CARRY,CARRY,CARRY,MOVE])
  * global.Spawn6.createDrone('soldier', [TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE, MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK], {targetRoom:'W10N55',target:'6956cbb3db4afb5c18bd7657'});
  * 
  * power bank units 24:17:7
  * global.Spawn5.createDrone('ranger', [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL], {targetRoom:'W10N55',target:'6956cbb3db4afb5c18bd7657'});
  * 2 healers per soldier for power banks
  * global.Spawn6.createDrone('soldier', [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK,MOVE,ATTACK], {targetRoom:'W10N55',target:'6956cbb3db4afb5c18bd7657'});
  * global.Spawn4.createDrone('healer', [MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL], {targetRoom:'W10N55',target:'6956cbb3db4afb5c18bd7657'});
  * 
  * 
  * Spawn3.createDrone('battleRam', [...m10, ...m10, ...m5, ...w10, ...w10, ...w5], {targetRoom:'W3N53', targets:['689304067f34614557adbaaf', '68b8cc96d9971d2fd4865d66', '6892855487d107cf6d26b31f', '68acbeec9ab1d19279d3638b']});
  * 
  */

Game.config = config;

module.exports = config;
