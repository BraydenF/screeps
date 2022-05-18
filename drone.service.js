const utils = require('utils');
const Queue = require('utils');

// todo: decide where to put this?
Array.prototype.rand = function() {
    console.log(this)
    return this[Math.floor(Math.random()*this.length)];
};

// todo: I think we are in a bit of an energy shortage.

const DRONE_LIMIT = 9;

const MODES = {
    STANDBY: 'standby',
    HARVEST: 'harvest',
    WITHDRAWL: 'withdrawl',
    UPGRADE: 'upgrade',
    // todo: add other modes
}


// todo: probably about time to start introducing a miner and transport role into the system
// todo: could update upgraders, builders, and mechanics to use stored energy rather than stuff in the spawn
const JOBS = {
    HARVESTER: 'harvester',
    UPGRADER: 'upgrader',
    BUILDER: 'builder',
    MECHANIC: 'mechanic',
    NONE: 'none',
}
// there was an enemy spawn event,might need to build offensive units sooner

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

class Hydra extends Creep {
    
}

class Roach extends Creep {

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
                    structure.structureType == STRUCTURE_TOWER ||
                    structure.structureType == STRUCTURE_CONTAINER
                    ) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
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
        if (targets.length > 0) {
            if (this.creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
                this.creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }

    harvest() {
        function getTarget(room) {
            const sources = room.find(FIND_SOURCES);
            const randomSource = sources.rand();
            if (randomSource) {
                return { room: room.name, _id: randomSource.id, obj: randomSource };
            }
            return null;
        }

        // create a _ service to manage where the drone is working (what source its targeting)
        // Currently randomly assigns room sources. I want to add on sources in other rooms. This will require a room target I believe, until its claimed. 
        // todo: move the target logic up a level, or create target service
        // if (Memory._targets[''])
        const targetableObject = Game.getObjectById(this.get('target'));

        let target;
        if (targetableObject) {
            target = { _id: targetableObject.id, creep: null, room: targetableObject.room, obj: targetableObject };
        }

        if (!target) {
            target = getTarget(this.creep.room);
            console.log(Object.keys(target));
            this.set('target', target._id);
        }

        if (this.creep.harvest(target.obj) === ERR_NOT_IN_RANGE) {
            const res = this.creep.moveTo(target.obj, {
                visualizePathStyle: { stroke: '#ffaa00' },
                // reusePath: 5, // default: 5
            });
            if (res !== 0) {
                // https://docs.screeps.com/api/#Creep.moveTo
                console.log(this.creep.name, 'moveTo', res);
            }
        }
    }

    store() {
        // console.log('who is calling this?', this.creep.name);
        const containersWithEnergy = Game.spawns['spawn'].room.find(FIND_STRUCTURES, {
            filter: (i) => i.structureType == STRUCTURE_CONTAINER &&
                           i.store[RESOURCE_ENERGY] > 0
        });
        const emptyContainers = Game.spawns['spawn'].room.find(FIND_STRUCTURES, {
            filter: (i) => i.structureType == STRUCTURE_CONTAINER &&
                           i.store[RESOURCE_ENERGY] < i.store.getCapacity()
        });

        console.log(emptyContainers);

        if (emptyContainers.length) {
            console.log(this.creep.name, this.creep.moveTo(emptyContainers[0]));
        }

        // const targets = this.creep.room.find(FIND_MY_STRUCTURES);
        // console.log('store', targets);


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

        // todo: I still need to expand energy harvesting out to another node. 
        // todo: consider updating the spawn rates of drones to be based on number of nodes available. 

        // todo: SCOUT WORK
        // todo: we can just add what ever logic is needed here.

        if (this.job === 'scout') {
            this.set('targetSource', '5bbcadf79099fc012e638375');
            const targetSource = this.get('targetSource');

            // console.log(targetSource, Game.getObjectById(outerResource));
            console.log(this.creep.name, '|', this.creep.harvest(targetSource), ERR_NOT_IN_RANGE);
            // console.log(this.creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ffaa00' } }));

            // if (this.creep.harvest(targetSource) == ERR_NOT_IN_RANGE) {
            //     this.creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ffaa00' } });
            // }

            // console.log('here?', this.creep.room.name);

            // const room = Game.spawns['spawn'].room;
            const roomName = this.creep.room.name;
            const exits = Game.map.describeExits(roomName);

            // console.log(exits[TOP]);
            // console.log(exits[RIGHT]);
            // console.log(exits[BOTTOM]);
            const leftRoomName = exits[LEFT];
            // this.harvest();

            /** todo
             * think of this like a harvest/movement subsystem.
             * If we can not target something we have the ID of, it is
             * in a different room. Then I just need to dermine
             * which direction the element is
             * (if possible)
             */
            // note: loops to left room infinitely
            const route = Game.map.findRoute(this.creep.room, leftRoomName);
            if(route.length > 0) {
                console.log('Now heading to room ' + route[0].room);
                const exit = this.creep.pos.findClosestByRange(route[0].exit);
                this.creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
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
                this.setMode('store');
            }
        }
    }

    processMode() {
        // actions[this.mode]();
        // load
        // unload
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
        } else if (this.mode === 'load') {
            // todo: combine harvest and withdraw modes, then deprecate them.
        } else if (this.mode === 'unload') {
            // todo: combine store and transfer modes, then deprecate them.
		} else if (this.mode === 'store') {
            this.store();
            // move to storage
            // drop?
            const targets = this.findEmptyStorages();
            // console.log('targets', targets);
            return this.transfer(targets[0]);
        } else if (this.mode === 'transfer') {
			const targets = this.findEmptyStorages();
            console.log('targets', targets);
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
		}
    }

    run () {
        this.processJob();
        this.processMode();
    }
}


function buyParts(budget, job) {
    const isStandardJob = job === 'harvester' || job === 'upgrader' || job === 'builder';
    const baseSetParts = [WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
    let remainingBudget = budget;
    const reciept = { work: 0, carry: 0, move: 0, parts: [], cost: 0 };

    if (job === 'scout' && remainingBudget > 500) {
        reciept.parts = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        // reciept.cost = 500;
    }

    if (isStandardJob && remainingBudget >= 350) {
        const baseSetCost = 350;
        const baseSet = { workMultiplier: 1, carryMultiplier: 2, moveMultiplier: 3 } // cost: 350
        const baseSetsCount = Math.floor(remainingBudget / baseSetCost);

        reciept.work = baseSetsCount * baseSet.workMultiplier;
        reciept.carry = baseSetsCount * baseSet.carryMultiplier;
        reciept.move = baseSetsCount * baseSet.moveMultiplier;

        for (let i = 0; i < baseSetsCount; i++) {
            for (let j = 0; j < baseSetParts.length; j++) {
                reciept.parts.push(baseSetParts[j]);
            }
        }

        remainingBudget = remainingBudget - (baseSetsCount * baseSetCost);

        while(remainingBudget > 100) {
            reciept.carry++;
            reciept.move++;

            reciept.parts.push[CARRY];
            reciept.parts.push[MOVE];

            remainingBudget = remainingBudget - 100;
        }

        // boosted model
        if (remainingBudget >= 50) {
            reciept.move++;
            reciept.parts.push[MOVE];
            remainingBudget = remainingBudget - 50;
        }
    } else if (remainingBudget >= 300) {
            reciept.work = 1;
            reciept.carry = 2;
            reciept.move = 2;

            reciept.parts = [WORK, CARRY, CARRY, MOVE, MOVE];
            remainingBudget = remainingBudget - 300;
    }

    reciept.cost = budget - remainingBudget;
    return reciept;
}

// todo: the idea of predefined queue existing for certain states. 
// Could create a 'initial' spawn queue [H,H,H,U,B...]
// Could create defensive or offensive spawn protocols
// push to the queue in batches to ensure proper rate of jobs
// push 2 builder to queue when a building is found (need better trigger)
//
const spawnQueueService = {
    _save: function(queue) {
        return Memory.spawns['spawn'].queue = spawnQueueService;
    },
    getQueue: function() {
      return Memory.spawns['spawn'].queue;
    },
    run: function() {
        const queue = getQueue();
        // const spawnScoutParamEx = { job: 'scout', budget: 1050 };
        // const spawnQueue = spawnQueueService._queue.peek();
        if (spawnQueue.length) {
            const { job, budget } = spawnQueue[0];
            droneService.createDrone(job, budget);
        }

        const drone = spawnQueueService._queue.dequeue();

        spawnQueueService._queue.length
        // spawnQueueService._data = { queue: spawnQueue };
        spawnQueueService._save();
    },
};

const droneService = {
    Drone: Drone,
    createDrone: function(job = 'harvester', budget = 300) {
        const reciept = buyParts(budget, job);
        console.log(`<b>Building drone:</b> ${job}:${budget}` );
        console.log(reciept.parts);
        return Game.spawns['spawn'].createCreep(reciept.parts, null, { role: 'drone', job: job });
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
        const room = Game.spawns['spawn'].room;
        const drones = droneService.getDrones();

        const spawnModules = {
            spawnQueue: function() {
                spawnQueueService.run();
            },
            lowDroneCount: function() {
                // todo: update spawn function to use the spawn queue system.
                if (room.energyAvailable >= 300) {
                    const res = droneService.createDrone('harvester', 300);
                    console.log(res);
                }
            },
            randomProduction: function() {
                // todo: update spawn function to use the spawn queue system.
                const room = Game.spawns['spawn'].room;
                const reciept = buyParts(room.energyCapacityAvailable);
                const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

                // less than 9 drones AND enough energy
                if (drones.length <= DRONE_LIMIT && room.energyAvailable >= room.energyCapacityAvailable) {
                    utils.randexec([45, 35, 20], [
                        // 40% - harvester
                        () => droneService.createDrone(JOBS.HARVESTER, room.energyAvailable),
                        // 40% - upgrader
                        () => droneService.createDrone(JOBS.UPGRADER, room.energyAvailable),
                        // 20% - builder IF construction sites exist
                        () => constructionSites.length && droneService.createDrone(JOBS.BUILDER, room.energyAvailable),
                    ]);
                }
            },
            run: function() {
                // const drones = droneService.getDrones();
                // if (spawnQueueService.droneInQueue()) {
                    // spawnModules.spawnQueue();
                // }
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

        // todo: can I use this find(FIND_TOMBSTONES) to remove dead drones from memory?
    },
    run: function() {
        droneService.droneManager();
        droneService.getDrones().forEach(drone => {
            try {
                drone.run();
            } catch (e) {
                console.log(drone.name, ':', e);
            }
        });
        // todo: how should I run the drone manager? Every 10 ticks?
    }
};

module.exports = droneService;
