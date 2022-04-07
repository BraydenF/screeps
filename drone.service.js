const utils = require('utils');

const DRONE_LIMIT = 12;

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

    requestAssignment() {
        // todo: check memory for how to assign a job
        return 'upgrader';
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
        // use a { builder: function() } function each
        if (this.job === 'builder') {
            if (this.isStandby()) {
                this.setMode('build');
            }
            if (this.isMode('build') && this.isEnergyEmpty()) {
                const { mode, message } = withdrawlOrHarvest(this);
                this.setMode(mode, message);

                // if (this.findResourceTargets(1).length) {
                //     this.setMode('withdrawl', '🔄 filling up!');
                // } else {
                //     this.setMode('harvest', '🔄 harvest');
                // }
            }
            if (!this.isMode('build') && this.isEnergyFull()) {
                this.setMode('build', '🚧 build');
            }
            // droneModules.builder();
    	} else if (this.job === 'upgrader') {
    	    if (this.isStandby()) {
                this.setMode('upgrade');
            }
            if (this.isMode('upgrade') && this.isEnergyEmpty()) {
                const { mode, message } = withdrawlOrHarvest(this);
                this.setMode(mode, message);

                // const gatherMethod = Memory.creepCount < 9 ? 'harvest' : 'withdrawl';
                // this.setMode(gatherMethod, '🔄 filling up!');
            }
            if (!this.isMode('upgrade') && this.isEnergyFull()) {
                this.setMode('upgrade', '⚡ upgrade');
            }
        }  else if (this.job === 'mechanic') {
            // todo: mechanic
            // drone.setMode('repair', '⚡ repair');
            // droneModules.mechanic();
        } else if (this.job === 'harvester') {
            if (this.isStandby()) {
                this.setMode('harvest');
            }
            if (!this.isMode('harvest') && this.isEnergyEmpty()) {
                this.setMode('harvest', '🔄 harvest');
            }
            if (!this.isMode('transfer') && this.isEnergyFull()) {
                this.setMode('transfer');
            }
            // droneModules.harvester();
        }
    }

    // todo: should I use the verbage "action" instead of a mode
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
		} else if (this.mode === 'upgrade') {
			return this.upgrade();
		} else if (this.mode === 'repair') {
			return this.repair();
		} else {
            return this.harvest();
        }
    }

    /**
     * Triggers run sequence on a configured Drone
     */
    run () {
        this.processJob();
        this.processMode();
    }
}

const droneService = {
    Drone: Drone,
    createDrone: function(job = 'harvester', kitName = 'default') {
        const kits = {
            default: { parts: [WORK, CARRY, MOVE], cost: 200 },
            eKit: { parts: [WORK, CARRY, CARRY, MOVE, MOVE], cost: 300 },
            v2: { parts: [WORK, CARRY, CARRY, CARRY, MOVE, MOVE], cost: 350 },
            v3: { parts: [WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 400 },
            v4: { parts: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 450 },
            v5: { parts: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 550 },
            'v5.idk': { parts: [WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], cost: 550 },
        };

        const kit = typeof kits[kitName] !== 'undefined' ? kits[kitName] : kits.default;
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
    droneManager: function () {
        const spawn = Game.spawns['spawn'];
        const drones = droneService.getDrones();

        /**
         * Emergency Plan: Create 3 harvesters;
         */
        if (spawn.room.energyAvailable >= 300 && drones.length < 3) {
            console.log('emergency drone created');
            droneService.createDrone('harvester', 'eKit');
        }

        // todo: refresh creeps time; Dont do this for random spawns probably
        // todo: add logic to convert builders when buildings need work
        // todo: assign mechanics when repairs are needed; might replace this idea with more random.


        // less than 9 drones AND enough energy
        if (drones.length <= DRONE_LIMIT && spawn.room.energyAvailable >= 550) {
            utils.randexec([45, 35, 20], [
                // 45% - harvester
                () => droneService.createDrone(JOBS.HARVESTER, 'v5'),
                // 35% - upgrader
                () => droneService.createDrone(JOBS.UPGRADER, 'v5'),
                // 20% - builder
                () => droneService.createDrone(JOBS.BUILDER, 'v5'),
            ]);
            if (utils.roll() > 40) {
                droneService.createDrone(JOBS.HARVESTER, 'v5');
            } else {
                droneService.createDrone(JOBS.UPGRADER, 'v5');
            }
        }
    },
    run: function() {
        droneService.droneManager();
        droneService.getDrones().forEach(drone => drone.run());
        // todo: how should I run the drone manager? Every 10 ticks?
    }
};

module.exports = droneService;
