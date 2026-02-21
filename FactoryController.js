const productionNotifier = require('productionNotifier');

const FACTORY_TARGET_ENERGY = 10000;
const storeCheckDelay = 500;
const BOOST_TIME = 1000;

const COMPRESSIONS = {
	K: RESOURCE_KEANIUM_BAR,
	L: RESOURCE_LEMERGIUM_BAR,
	U: RESOURCE_UTRIUM_BAR,
	Z: RESOURCE_ZYNTHIUM_BAR,
	H: RESOURCE_REDUCTANT,
	O: RESOURCE_OXIDANT,
	X: RESOURCE_PURIFIER,
	G: RESOURCE_GHODIUM_MELT,
};

// the minimum should impact the job amount.
// 10000 -> 2000, 50000 -> 10000
const compressionsConfig = {
	K: { max: 50000, jobAmount: 3500 },
	L: { max: 50000, jobAmount: 3500 },
	U: { max: 50000, jobAmount: 3500 },
	Z: { max: 50000, jobAmount: 3500 },
	H: { max: 35000, jobAmount: 2000 },
	O: { max: 15000, jobAmount: 1000 },
	X: { max: 55000, jobAmount: 2500 },
	G: { max: 50000, jobAmount: 3500 },
};

const basicCommodities = {
	mist: 'condensate',
	biomass: 'cell',
	metal: 'alloy',
	silicon: 'wire',
}

const advancedCommodities = {
	1: {
		concentrate: Infinity,
		switch: Infinity,
		composite: 3500,
	},
	2: {
		extract: Infinity,
		transistor: Infinity,
		crystal: 3000,
	},
	3: {
		spirit: Infinity,
		microchip: Infinity,
		liquid: 1000,
	},
}

class FactoryController {
	get taskController() {
		return this.hive.taskController;
	}

	get terminalController() {
		return this.hive.terminalController;
	}

	static getComponents(resource) {
		return typeof COMMODITIES[resource] !== 'undefined' ? COMMODITIES[resource].components : {};
	}

	static batchesProducible(batchMap) {
    let min = Infinity;
    let found = false;

    for (const resource in batchMap) {
      const amount = batchMap[resource];
      if (amount < min) {
        min = amount;
      }
      found = true;
    }

    return found ? min : 0;
	}

	constructor(factory) {
		if (typeof factory === 'string') factory = Game.getObjectById(factory);

		this.factory = factory;
		this.room = this.factory.room;
		this.hive = global.hives[this.room.name];
		this.storage = this.room.storage;

		const mem = Memory.rooms[this.room.name].factory || {};
		if (!mem.id) mem.id = this.factory.id
		Memory.rooms[this.room.name].factory = mem;
	}

	get(key) {
		const mem = this.room.memory['factory'] || {};
		return mem[key];
	}

	set(key, value) {
		this.room.memory['factory'][key] = value;
	}

	getConfig(key) {
		const config = this.get('config') || {};
		if (key) {
			return config[key];
		}
		return config;
	}

	getResourceInRoom(resource) {
		const storageCount = this.storage.store.getUsedCapacity(resource);
		const factoryCount = this.factory.store.getUsedCapacity(resource);
		return storageCount + factoryCount;
	}

	getBatchMap(resource) {
		const components = FactoryController.getComponents(resource);
		const jobAmount = COMMODITIES[resource].amount;

		const batchMap = {};
		for (const component in components) {
			batchMap[component] = Math.floor(this.storage.store.getUsedCapacity(component) / components[component]);
		}
		return batchMap;
	}

	isAcceptingJobs() {
		return !this.get('job');
	}

	attemptJob(resource) {
		const batchMap = this.getBatchMap(resource);
		const batches = FactoryController.batchesProducible(batchMap);
		const maxBatches = Math.ceil(BOOST_TIME / COMMODITIES[resource].cooldown);

		if (batches >= maxBatches) {
			this.setJob(resource, maxBatches, this.factory.level);
			return OK;
		}
		return ERR_NOT_ENOUGH_RESOURCES;
	}

	setJob(resource, amount, level) {
		const job = { resource, amount, level, startTime: Game.time };
		const requestedResources = this.get('requestedResources') || {};
		const batches = amount / COMMODITIES[resource].amount;

		const components = FactoryController.getComponents(resource);
		for (const component in components) {
			requestedResources[component] = batches * components[component];
		}

		this.setRequestedResources(requestedResources);
		this.set('job', job);
		// update to save memory
		this.room.memory.factory = {
			...this.room.memory.factory,
			hasComponents: undefined,
			nextManageStore: Game.time,
			requestedResources,
			job,
		}
		return job;
	}

	clearJob() {
		this.setRequestedResources({ energy: 10000 });
		this.set('job', null);
		this.set('hasComponents', undefined);
	}

	getNextJob() {
		const compressions = this.getConfig('compressions') || compressionsConfig;

		for (const resource in compressions) {
			const config = compressions[resource];
			const compressedResource = COMPRESSIONS[resource];

			// if (config.min) console.log('WOOOO', this.storage.store[resource] <= config.min, this.componentsAvailable(resource, config.min));
			// if (config.min && this.storage.store[resource] <= config.min) {
			// 	return this.setJob(resource, config.min); // decompress minerals
			// } else 
			if (compressedResource && this.storage.store.getUsedCapacity(resource) >= config.max) {
				return this.setJob(compressedResource, config.jobAmount); // compress minerals
			}
		}

		// is there a power creep and are their available OPS
		if (this.factory.level >= 1) {
			// If I find any PC instead of just checking the room, I can request the PC if needed.
			const pc = this.room.find(FIND_POWER_CREEPS, { filter: (pc) => {
				return pc.powers[PWR_OPERATE_FACTORY] && pc.powers[PWR_OPERATE_FACTORY].level === this.factory.level && pc.powers[PWR_OPERATE_FACTORY].cooldown === OK && pc.store.getUsedCapacity('ops') >= 100;
			}}).onFirst(f => f);

			if (pc && pc.powers[PWR_OPERATE_FACTORY] && pc.powers[PWR_OPERATE_FACTORY].cooldown === OK) {
				const jobs = advancedCommodities[this.factory.level];
				if (jobs) for (const resource in jobs) {
					if (this.storage.store[resource] <= jobs[resource]) {
						if (this.attemptJob(resource) === OK) return;
					}
				}
			}
		}

		for (const resource in basicCommodities) {
			const commodity = basicCommodities[resource];
			const components = FactoryController.getComponents(commodity);
			const jobAmount = COMMODITIES[commodity].amount;

			const batchMap = {};
			let mineral;
			if (this.getResourceInRoom(resource) >= jobAmount) {
				// for (const component in components) {

				let jobBatches = Infinity;
				let found = false;

				for (const component in components) {
			    const resourceAmount = this.getResourceInRoom(component);
			    const possibleBatches = Math.floor(resourceAmount / components[component]);
			    batchMap[component] = possibleBatches;

			    if (possibleBatches < jobBatches) {
		        jobBatches = possibleBatches;
			    }

			    if (component !== 'energy' && component !== resource) {
		        mineral = component;
			    }
			    found = true;
				}

				// Handle the case where components might be empty
				if (!found) jobBatches = 0;

				const jobLimit = 10;
				if (jobBatches >= jobLimit) {
					return this.setJob(basicCommodities[resource], jobAmount * jobLimit);
				} else {
					if (mineral && batchMap[mineral] === 0) {
						// I don't have any bars, can I compress them?
						const compressionBatchMap = this.getBatchMap(mineral);
						const subBatches = FactoryController.batchesProducible(compressionBatchMap);

						if (subBatches > 0) {
							return this.setJob(mineral, subBatches * COMMODITIES[mineral].amount);
						} else {
							// requests resources in increments of 10000
							const requestAmount = jobAmount * jobBatches <= 10000 ? jobAmount * jobBatches : 10000;
							if (this.terminalController.getRequestAmount(mineral) < requestAmount) {
								this.terminalController.createRequest(mineral, requestAmount);
							}
						}
					}
				}
			}
			// deprecating as this is not really in use.
			// const matMap = { silicon: 'utrium_bar' }
			// else if (matMap[resource] && this.storage.store[matMap[resource]] > 10000) {
			// 	this.terminalController.createRequest(resource, 10000);
			// }
		}

		// compress energy
		if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 250000) {
			return this.setJob(RESOURCE_BATTERY, 5000);
		}
	}

	setRequestedResources(request = {}) {
		if (!request['energy'] || request['energy'] < FACTORY_TARGET_ENERGY) {
			request['energy'] = FACTORY_TARGET_ENERGY;
		}
		this.set('requestedResources', request);
	}

	getUsedCapacity(resource = RESOURCE_ENERGY) {
		return this.factory.store.getUsedCapacity(resource);
	}

	componentsAvailable(resource, amount = 1) {
    const components = COMMODITIES[resource].components;
    for (const component in components) {
      if (this.storage.store.getUsedCapacity(component) < (components[component] * amount)) {
        return false;
      }
    }
  	return true;
	}

	// storePreCheck() {
	// 	const job = this.get('job');
	// 	const storeOkay = this.get('storeOkay') || 0;
	// 	const lastManageStore = this.get('lastManageStore') || 0;

	// 	if (storeOkay < lastManageStore) {
	// 		const drone = this.taskController.getFreeDrone();
	// 		return drone;
	// 	}
	// }

	manageStore() {
		// what if I just didnt have a drone....
		const drone = this.taskController.getFreeDrone();
		if (!drone) {
      this.set('nextManageStore', Game.time + 13);
			return;
		}

    let tasks = [];
		const requestedResources = this.get('requestedResources') || {};

    if (this.room.storage.store.getFreeCapacity('energy') >= 5000) {
    	for (const resource in this.factory.store) {
	    	const requestAmount = requestedResources[resource] || 0;
	    	const requestDelta = requestAmount > 0 ? 1000 : 0;
	      if (this.factory.store[resource] > (requestAmount + requestDelta)) {
	        tasks = [...tasks, ...this.taskController.createTransferTask(resource, this.factory, this.storage)];
	      }
	    }
    }

    for (const resource in requestedResources) {
    	const requestAmount = requestedResources[resource] || 0;
      if (requestAmount > this.factory.store[resource] && this.storage.store.getUsedCapacity(resource) > 0) {
        tasks = [...tasks, ...this.taskController.createTransferTask(resource, this.storage, this.factory)];
      }
    }

    if (tasks.length) {
      drone.setTaskQueue(tasks);
      this.set('nextManageStore', Game.time + 53);
    } else {
    	this.set('nextManageStore', Game.time + 263);
    }
	}

	produce() {
		const job = this.get('job');
		let requestedResources = this.get('requestedResources') || {};
   	const components = COMMODITIES[job.resource].components;
   	let hasComponents = this.get('hasComponents');

		if (!hasComponents) {
			let allFound = true;
	    for (const component in components) {
        if (this.getUsedCapacity(component) < components[component]) {
          allFound = false;
          break; // Optimization: Exit the moment ONE requirement isn't met
        }
	    }

	    if (allFound) {
        hasComponents = true;
        this.set('hasComponents', true);
	    }
		}

		if (hasComponents) {
			job.ready = true;
			const status = this.factory.produce(job.resource);

			if (status === OK) {
				this.handleJobSuccess(job, requestedResources, components);
				productionNotifier.incrementCounter(job.resource, COMMODITIES[job.resource].amount);
			} else if (status === ERR_RCL_NOT_ENOUGH || status === ERR_INVALID_TARGET) {
				this.clearJob();
			} else if (status === ERR_NOT_ENOUGH_RESOURCES) {
				this.set('hasComponents', false);
			}
		} else if (Game.time - (job.lastRunTime || job.startTime) >= 1000) {
			for (const resource in requestedResources) {
				if (this.factory.store.getUsedCapacity(resource) + this.storage.store.getUsedCapacity(resource) < requestedResources[resource]) {
					this.clearJob();
				}
			}
		}
	}

	handleJobSuccess(job, requestedResources, components) {
		job.lastRunTime = Game.time;
		if (typeof job.amount === 'number') {
			job.amount = job.amount - COMMODITIES[job.resource].amount;
			if (job.amount <= 0) job = null;
		}

		for (const component in components) {
			if (typeof requestedResources[component] === 'number') {
				requestedResources[component] = requestedResources[component] - components[component];
			}
		}

		this.setRequestedResources(requestedResources);
		this.set('job', job);
	}

	init() {
		const factoryMem = this.room.memory.factory || {};
		this.factory = factoryMem.id && Game.getObjectById(factoryMem.id);
		if (!this.factory) {
			this.factory = this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } }).onFirst(f => f)
			this.set('id', this.factory.id);
		}
		return factoryMem;
	}

	run () {
		try {
			const mem = this.init();

			if (!mem.job) {
				const lastJobCheck = this.get('lastJobCheck') || 0;
				if (Game.time - lastJobCheck >= 250) {
					this.set('lastJobCheck', Game.time);
					this.getNextJob();
				}
				return;
			}

			if ((mem.nextManageStore || 0) <= Game.time) {
				this.manageStore();
			}

			if (this.factory.cooldown === OK) {
				this.produce(mem.job.resource);
			}
		} catch (e) {
			console.log(this.room.name,'factory-goof', e.toString());
			throw e;
		}
	}

	jobReport() {
		const job = this.get('job');
		if (job) {
			return ` - ${job.resource}:${job.amount}`;
		}
		return '';
	}
}

module.exports = FactoryController;
