const utils = require('utils');

const STANDYBY_MODE = 'standby';
const HARVEST_MODE = 'harvest';
const BUILD_MODE = 'build';
const JOB_NONE = 'none';

function getRandomSource(sources) {
    const target = sources[utils.roll() < 50 ? 1 : 0];
    return target.id;
}

// todo: need a drone controller
function foo() {
    const spawn = Game.spawns['spawn'];

    const drones = [];
    for(const name in Game.creeps) {
        const creep = Game.creeps[name];
        drone.push(new Drone(creep));
    }
}

class Creep {
	constructor(creep) {
        const memory = creep.memory || {};
		this.creep = creep;
        this.mode = memory.mode ? memory.mode : 'standby';
    }

    isMode(mode) {
        return this.mode === mode;
    }

    setMode(mode, message = null) {
    	if (message) this.creep.say(message);
        this.mode = mode;
        this.updateMemory();
    }

    updateMemory() {
        this.creep.memory.mode = this.mode
        this.creep.memory.targetSource = this.targetSource
    }

    clearMemory() {
        this.creep.memory = {};
    }
}

class Drone extends Creep {
    /**
     * @params creep {Creep}
     */
    constructor(creep, job = 'none') {
    	super(creep);
        const memory = creep.memory || {};
        const sources = creep.room.find(FIND_SOURCES);

        this.job = job;
        this.targetSource = memory.targetSource
        	? memory.targetSource
        	: getRandomSource(sources);

        this.updateMemory();
    }

    isEnergyEmpty() {
        return this.creep.store[RESOURCE_ENERGY] == 0;
    }

    isEnergyFull() {
        return this.creep.store.getFreeCapacity() == 0;
    }

    findResourceTargets(resourceAmount = 0) {
        return this.creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN) &&
                    structure.store[RESOURCE_ENERGY] >= resourceAmount
            }
        });
    }

    findEmptyStorages() {
        return creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN ||
                    structure.structureType == STRUCTURE_TOWER) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
    }

    dropAll() {
            // drop all resources
            for(const resourceType in this.creep.carry) {
                this.creep.drop(resourceType);
            }
    }

    pickup() {
        const target = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
        console.log('picking up', target);

        if (target) {
            if(this.creep.pickup(target) == ERR_NOT_IN_RANGE) {
                this.creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }

    transfer(storage) {
        if(this.creep.transfer(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            this.creep.moveTo(storage);
        }
    }

    withdrawl(storage) {
    	if(this.creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
		    this.creep.moveTo(storage);
		}
    }

    repair() {
        const targets = this.creep.room.find(FIND_STRUCTURES, {
            filter: object => object.hits < object.hitsMax
        });
        targets.sort((a,b) => a.hits - b.hits);
        if(targets.length > 0) {
            if(this.creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
                this.creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }

    harvest() {
        const targetSource = Game.getObjectById(this.creep.memory.targetSource);
        if (this.creep.harvest(targetSource) == ERR_NOT_IN_RANGE) {
            this.creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    }

    build() {
        const targets = this.creep.room.find(FIND_CONSTRUCTION_SITES);

    	// todo: how can we better handle the build order? Do we need a build queue?

        if (targets.length) {
            if (this.creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                this.creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }

    upgrade() {
    	const controller = this.creep.room.controller;
    	if(this.creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            this.creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }
}

const roleDrone = {
	jobController: function(drone) {
		if (drone.job === 'builder') {
    		if (drone.isMode('build') && drone.isEnergyEmpty()) {
				if (drone.findResourceTargets(1).length) {
					drone.setMode('withdrawl', '🔄 filling up!');
				} else {
					drone.setMode('harvest', '🔄 harvest');
				}
	        }

	        if (!drone.isMode('build') && drone.isEnergyFull()) {
	            drone.setMode('build', '🚧 build');
	        }
    	}
	},
	modeController: function(drone) {
		if (drone.mode === 'withdrawl') {
			const targets = drone.findResourceTargets(1);
			if (targets.length) {
				return drone.withdrawl(targets[0]);
			} else {
				return drone.setMode('harvest', '🔄 harvest');
			}
		} else if (drone.mode === 'transfer') {
			const targets = drone.findEmptyStorages();
			if (targets.length) {
				return drone.transfer(targets[0]);
			}
		}else if (drone.mode === 'harvest') {
			return drone.harvest();
		} else if (drone.mode === 'build') {
			return drone.build();
		} else if (drone.mode === 'upgrade') {
			return drone.upgrade();
		} else if (drone.mode === 'repair') {
			return drone.repair();
		}
	},
    /** @param {Creep} creep **/
    run: function(creep) {
        creep.say('beta'); // todo: remove
        const drone = new Drone(creep, 'builder');

        roleDrone.jobController(drone);
        roleDrone.modeController(drone);
    }
};

module.exports = roleDrone;
