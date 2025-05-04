// tower management system
const spawn = Game.spawns['spawn'];
const defaultConfig = {
    drone_limit: 9,
    min_wall: 50000,
}

class RoomConfig {
    constructor(roomName, options = {}) {
        this.roomName = roomName;
        this.options = { ...defaultConfig, ...options };
    }
    get options() {
        return this.options;
    }
    set options(options) {
        // so, you can use a setter to make immutable fields on an object.
        // Can a setter be progomatically added?
        // throw new Error('Unable to update options, please use a setter;');
    }

}

const foo = new RoomConfig('test', { min_wall: 2500 });
// foo.options = { hacked: true };

// todo: move this note to somewhere it makes a bit more sense
// someone outlines a maintenance area and some wall health minimums
// I likely need to set these types of elements up
// room_strategy : {
//   'W5S7': {
//     maintenance_area: {ax: 11, ay: 5, bx: 46, by: 30},
//     min_wall: 300000,
// },
// 'W4S7': {
//   maintenance_area: {ax: 0, ay: 0, bx: 49, by: 49},
//   min_wall: 75000,
// }

// todo: set up a method for the tower to reserve a harvester for a constant energy source.
// This will allow the building to manage its own power source as needed.
// this idea could be independentily useful if attacked. Could reserve more if needed
const towerService = {
    getTowers: function() {
        return spawn.room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
    },
    run: function() {
        const towers = towerService.getTowers();
        const tower = towers.length ? towers[0] : null;

        if (tower) {
            // todo: consider setting towers to keep an energy reserve for defence
            const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax && structure.hits < defaultConfig.min_wall
            });

            // console.log('pos', Object.keys(closestDamagedStructure.pos));

            if(closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            }

            const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(closestHostile) {
                console.log(`User ${closestHostile.owner.username} spotted!`);
                tower.attack(closestHostile);
            }
        }
    }
}

module.exports = towerService;
