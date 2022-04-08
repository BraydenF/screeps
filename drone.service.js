const utils = require('utils');

const DRONE_LIMIT = 10;

const MODES = {
    STANDBY: 'standby',
    HARVEST: 'harvest',
    WITHDRAWL: 'withdrawl',
    UPGRADE: 'upgrade',
    // todo: add other modes
}

const JOBS = {
    HARVESTER: 'harvester',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    MECHANIC: 'mechanic',
    NONE: 'none',
}

function getRandomSource(sources) {
    const target = sources[utils.roll() < 50 ? 1 : 0];
    return target.id;
}

// todo: deprecate this and use reference in creep.service
class Creep {
	constructor(creep) {
        const memory = creep.memory || {};
        this.name = creep.name;
		this.creep = creep;
		this.mode = memory.mode ? memory.mode : 'standby';
        this.mode = memory.mode ? memory.mode : 'standby';
    }

    get(key) {
        return this.creep.memory[key];
    }

    set(key, value) {
        this.key = value;
        this.creep.memory[key] = value;
    }

    isMode(mode) {
        return this.mode === mode;
    }

    setMode(mode, message = null) {
    	if (message) this.creep.say(message);
    	this.set('mode', mode);
    }

    isStandby() {
        return !this.mode || this.isMode('standby');
    }

    clearMemory() {
        this.creep.memory = {};
    }
}

class Drone extends Creep {
    /**
     * @params creep {Creep}
     */
    constructor(creep, job) {
        if (!creep) {
            throw new Error('Must supply a creep');
        }

    	super(creep);
        const memory = creep.memory || {};
        const sources = creep.room.find(FIND_SOURCES);

        // pulls old job, new job can be passed to contrucor
        this.set('job', job ? job : memory.job);
        this.set('mode', memory.mode ? memory.mode : 'standby');
        this.set('targetSource', memory.targetSource);
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
        return this.creep.room.find(FIND_STRUCTURES, {
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

    transfer(target) {
        if(this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            this.creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }

    withdrawl(target) {
    	if(this.creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
		    this.creep.moveTo(target);
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
        let target = this.get('targetSource');
        if (!target) {
            target = getRandomSource(this.creep.room.find(FIND_SOURCES));
            this.set('targetSource', target);
        }

        const targetSource = Game.getObjectById(target);

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

    recharge() {
        // todo: get recharged by the spawn
    }

    toString() {
        return `{ name: ${this.name}, job: ${this.get('job')}, mode: ${this.get('mode')}}`;
    }

    processJob() {
        this.job = this.get('job');
        
        function withdrawlOrHarvest(obj) {
            if (obj) {
                if (Memory.creepTracker.creepCount < DRONE_LIMIT) {
                    return { mode: MODES.HARVEST, message: '🔄 harvest' };
                }

                const arbitrary_number = 350;
                const targets = obj.findResourceTargets(1);
                if (targets[0].room.energyAvailable > arbitrary_number) {
                    return { mode: MODES.WITHDRAWL, message: '🔄 filling up!' };
                }

                return { mode: MODES.HARVEST, message: '🔄 harvest' };
            }
        }

        // todo: come back to this idea of a module system for drones
        // todo: if I want to do this idea, I should try and use protoTyping for it. I think I could add this to drones
        if (this.job === 'upgrader') {
            if (this.isStandby()) {
                this.setMode('upgrade');
            }
            if (this.isMode('upgrade') && this.isEnergyEmpty()) {
                const { mode, message } = withdrawlOrHarvest(this);
                this.setMode(mode, message);
            }
            if (!this.isMode('upgrade') && this.isEnergyFull()) {
                this.setMode('upgrade', '⚡ upgrade');
            }
        }
        if (this.job === 'builder') {
            // job change condition: nothing to build
            const targets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
            if (!targets.length) {
                this.set('job', JOBS.MECHANIC);
            }

            if (this.isStandby()) {
                this.setMode('build');
            }
            if (this.isMode('build') && this.isEnergyEmpty()) {
                const { mode, message } = withdrawlOrHarvest(this);
                this.setMode(mode, message);
            }
            if (!this.isMode('build') && this.isEnergyFull()) {
                this.setMode('build', '🚧 build');
            }
    	}
        if (this.job === JOBS.MECHANIC) {
            // job change condition: nothing to repair
            const targets = this.creep.room.find(FIND_STRUCTURES, {
                filter: object => object.hits < object.hitsMax
            });
            if (!targets.length) {
                this.set('job', JOBS.HARVESTER);
            }

            if (this.isStandby()) {
                this.setMode('repair', '⚡ repair');
            }
            if (!this.isMode('repair') && this.isEnergyEmpty()) {
                // const { mode, message } = withdrawlOrHarvest(this);
                this.setMode('harvest', '🔄 harvest');
            }
            if (!this.isMode('repair') && this.isEnergyFull()) {
                this.setMode('repair', '⚡ repair');
            }
        }
        if (this.job === 'harvester') {
            if (this.isStandby()) {
                this.setMode('harvest');
            }
            if (!this.isMode('harvest') && this.isEnergyEmpty()) {
                this.setMode('harvest', '🔄 harvest');
            }
            if (!this.isMode('transfer') && this.isEnergyFull()) {
                this.setMode('transfer');
            }
        }
    }

    processMode() {
        // actions[this.mode]();
        if (this.mode === 'withdrawl') {
			const targets = this.findResourceTargets(1);
			if (targets.length) {
                const result = this.withdrawl(targets[0]);
                // todo: double check this is working as intended
                if (result === ERR_NOT_ENOUGH_RESOURCES) {
                    return this.setMode('harvest', '🔄 harvest');
                }
				return result;
			} else {
				return this.setMode('harvest', '🔄 harvest');
			}
		} else if (this.mode === 'transfer') {
			const targets = this.findEmptyStorages();
            return this.transfer(targets[0]);
		} else if (this.isMode('harvest')) {
		    // todo: check statu sof nodes to determine which node to harvest
			return this.harvest();
		} else if (this.isMode('build')) {
			return this.build();
			// todo: nothing to build? Become a mechanic.
		} else if (this.mode === 'upgrade') {
			return this.upgrade();
		} else if (this.mode === 'repair') {
			return this.repair();
			// todo: nothing to repair? Become a an upgrader?
		} else {
            return this.harvest();
        }
    }

    run () {
        this.processJob();
        this.processMode();
    }
}

const kits = {
    default: { parts: [WORK, CARRY, MOVE], cost: 200 },
    eKit: { parts: [WORK, CARRY, CARRY, MOVE, MOVE], cost: 300 },
    v2: { parts: [WORK, CARRY, CARRY, CARRY, MOVE, MOVE], cost: 350 },
    v3: { parts: [WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 400 },
    v4: { parts: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 450 },
    v5: { parts: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 550 },
    'v5.idk': { parts: [WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 550 },
    v6: { parts: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], cost: 650 },
    v7: { parts: [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE], cost: 750 },
    v8: { parts: [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], cost: 800 },
};
let foo;

// w=1 e > 400 || w=

// first 200 is always [work, carry, move]
// extra 50 is always move.
// (rest / x) 

    function buyParts(budget) {
        let remainingBudget = budget;
        const reciept = { work: 0, carry: 0, move: 0 };

        // MVP parts
        if (remainingBudget > 200) {
            remainingBudget = remainingBudget - 200;
            reciept.work++;
            reciept.carry++;
            reciept.move++;
        }

        // boosted model
        if (remainingBudget % 100 === 50) {
            reciept.move++;
        }

        // { work: 1, carry: 1, n: 1, move: 1.5 }
        // Remaining budget to be spent as function of work and carry parts
        // is it 2 carry parts per work?
        // how many moves?

        
        // work - cost: 100, 
        // carry - cost: 50, 
        // move -  cost: 50, 

        return reciept;
    }

foo = { work: 1, carry: 1, n: 2, move: 1 } // 200
foo = { work: 1, carry: 2, n: 3, move: 2 } // 300
foo = { work: 1, carry: 3, n: 3, move: 3 } // 350
// foo = { work: 1, carry: 2, n: 3, move: 3 } // 400
foo = { work: 2, carry: 2, n: 4, move: 3 } // 450
foo = { work: 3, carry: 2, n: 5, move: 3 } // 550
// foo = { work: 2, carry: 4, n: 6, move: 4 } // 550
foo = { work: 3, carry: 3, n: 6, move: 4 } // 650
foo = { work: 3, carry: 4, n: 7, move: 4 } // 750
foo = { work: 3, carry: 4, n: 7, move: 5 } // 800



const droneService = {
    Drone: Drone,
    createDrone: function(job = 'harvester', kitName = 'default') {
        // update to default to largest kit possible
        const kit = typeof kits[kitName] !== 'undefined' ? kits[kitName] : kits.default;
        console.log(`<b>Building drone:</b> ${job}:${kitName}` )
        return Game.spawns['spawn'].createCreep(kit.parts, null, { role: 'drone', job: job });
    },
    getDrones: function(job) {
        const drones = [];
        for(const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role === 'drone') {
                if (job) { // only displays drones of job
                    if (creep.memory.job === job) {
                        drones.push(new Drone(creep));
                    }
                } else { // displays all drones
                    drones.push(new Drone(creep));
                }
            }
        }

        return drones;
    },
    getKit: function(energyLimit) {
        return Object.keys(kits).reduce((targetKey, key) => {
            if (kits[key].cost > kits[targetKey].cost && kits[key].cost < energyLimit) {
                return key;
            }
            return targetKey;
        }, 'default');
    },
    droneManager: function () {
        const room = Game.spawns['spawn'].room;
        const drones = droneService.getDrones();

        const spawnModules = {
            lowDroneCount: function() {
                const target_key = droneService.getKit(room.energyCapacityAvailable);
                if (room.energyAvailable >= 300) {
                    droneService.createDrone('harvester', target_key);
                }
            },
            randomProduction: function() {
                const room = Game.spawns['spawn'].room;
                // const drones = droneService.getDrones();
                const target_key = droneService.getKit(room.energyCapacityAvailable);
                const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

                // less than 9 drones AND enough energy
                if (drones.length <= DRONE_LIMIT && room.energyAvailable >= kits[target_key].cost) {
                    utils.randexec([45, 35, 20], [
                        // 40% - harvester
                        () => droneService.createDrone(JOBS.HARVESTER, target_key),
                        // 40% - upgrader
                        () => droneService.createDrone(JOBS.UPGRADER, target_key),
                        // 20% - builder IF construction sites exist
                        () => constructionSites.length && droneService.createDrone(JOBS.BUILDER, target_key),
                    ]);
                }
            },
            run: function() {
                // const drones = droneService.getDrones();
                if (drones.length < DRONE_LIMIT / 2) {
                    spawnModules.lowDroneCount();
                } else {
                    spawnModules.randomProduction();
                }
            }
        }

        spawnModules.run();

        // todo: refresh creeps time; Dont do this for random spawns probably
        // todo: add logic to convert builders when buildings need work
        // todo: should I actually treat mechanics as a sub-mode of builders? The job can exist and I can job manage? But I have been having issues with job management.
        // todo: assign mechanics when repairs are needed; might replace this idea with more random.


        // const target_key = getKit(room.energyCapacityAvailable);
        // // less than 9 drones AND enough energy
        // if (drones.length <= DRONE_LIMIT && room.energyAvailable >= kits[target_key].cost) {
        //     utils.randexec([45, 35, 20], [
        //         // 45% - harvester
        //         () => droneService.createDrone(JOBS.HARVESTER, target_key),
        //         // 35% - upgrader
        //         () => droneService.createDrone(JOBS.UPGRADER, target_key),
        //         // 20% - builder
        //         () => droneService.createDrone(JOBS.BUILDER, target_key),
        //     ]);
        // }

        // todo: can I use this find(FIND_TOMBSTONES) to remove dead drones from memory?
    },
    run: function() {
        droneService.droneManager();
        droneService.getDrones().forEach(drone => drone.run());
        // todo: how should I run the drone manager? Every 10 ticks?
    }
};

module.exports = droneService;
