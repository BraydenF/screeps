const productionNotifier = require('productionNotifier');

const FACTORY_TARGET_ENERGY = 10000;
const storeCheckDelay = 500;

const COMPRESSIONS = {
	K: RESOURCE_KEANIUM_BAR,
	L: RESOURCE_LEMERGIUM_BAR,
	U: RESOURCE_UTRIUM_BAR,
	Z: RESOURCE_ZYNTHIUM_BAR,
	H: RESOURCE_REDUCTANT,
	O: RESOURCE_OXIDANT,
};

// jost a job config?
// the minimum should impact the job amount.
const compressionsConfig = {
	K: { max: 50000, jobAmount: 3500 },
	L: { max: 50000, jobAmount: 3500 },
	U: { max: 50000, jobAmount: 3500 },
	Z: { max: 50000, jobAmount: 3500 },
	H: { max: 35000, jobAmount: 2000 },
	O: { max: 15000, jobAmount: 1000 },
};

const basicCommodities = {
	mist: 'condensate',
	biomass: 'cell',
	metal: 'alloy',
	silicon: 'wire',
}

const matMap = {
	silicon: 'utrium_bar',
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
		return Math.min(...Object.keys(batchMap).map(resource => batchMap[resource]));
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
		Object.keys(components).forEach(component => {
			batchMap[component] = Math.floor(this.storage.store.getUsedCapacity(component) / components[component]);
		});
		return batchMap;
	}

	setJob(resource, amount, level) {
		const job = { resource, amount, level, startTime: Game.time };
		const requestedResources = this.get('requestedResources') || {};
		const batches = amount / COMMODITIES[resource].amount;

		const components = FactoryController.getComponents(resource);
		Object.keys(components).forEach(component => {
			requestedResources[component] = batches * components[component];
		});

		this.setRequestedResources(requestedResources);
		this.set('job', job);
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
			if (this.storage.store.getUsedCapacity(resource) >= config.max) {
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
				switch (this.factory.level) {
					case 1:
						const t1Resources = ['concentrate', 'switch'];
						for (const resource of t1Resources) {
							const batchMap = this.getBatchMap(resource);
							const batches = FactoryController.batchesProducible(batchMap);
							const maxBatches = Math.ceil(1000 / COMMODITIES[resource].cooldown);

							if (batches >= maxBatches) {
								return this.setJob(resource, COMMODITIES[resource].amount * 24, 1);
							}
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
				const jobBatches = Math.min(...Object.keys(components).map(component => {
					const resourceAmount = this.getResourceInRoom(component);
					batchMap[component] = Math.floor(resourceAmount / components[component]);

					if (component !== 'energy' && component !== resource) {
						mineral = component;
					}
					return batchMap[component];
				}));

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
			} else if (matMap[resource] && this.storage.store[matMap[resource]] > 10000) {
				this.terminalController.createRequest(resource, 10000);
			}
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
		// componentsAvailable
   	return Object.keys(components).reduce((acc, component) => {
   		// console.log(component, this.storage.store.getUsedCapacity(component), (components[component] * amount));
			return acc && this.storage.store.getUsedCapacity(component) >= (components[component]);
		}, true);
	}

	storePreCheck() {
		const job = this.get('job');
		const storeOkay = this.get('storeOkay') || 0;
		const lastManageStore = this.get('lastManageStore') || 0;
		const lastEventTime = Math.max(lastManageStore, storeOkay);
		const jobStarted = job ? Game.time - job.startTime <= 100 : false;

		if (storeOkay < lastManageStore || jobStarted || Game.time - lastEventTime >= 500) {
			const drone = this.taskController.getFreeDrone();
			return drone;
		}
	}

	manageStore() {
		const drone = this.storePreCheck();
		if (!drone) return;

		const requestedResources = this.get('requestedResources') || {};
    const resources = requestedResources && Object.keys(requestedResources);
    let tasks = [];

    if (this.room.storage.store.getFreeCapacity('energy') >= 5000) {
	    Object.keys(this.factory.store).forEach(resource => {
	    	const requestAmount = requestedResources[resource] || 0;
	    	const requestDelta = requestAmount > 0 ? 1000 : 0;
	      if (this.factory.store[resource] > (requestAmount + requestDelta)) {
	        tasks = [...tasks, ...this.taskController.createTransferTask(resource, this.factory, this.storage)];
	      }
	    });
    }

    resources.forEach(resource => {
    	const requestAmount = requestedResources[resource] || 0;
      if (requestAmount > this.factory.store[resource] && this.storage.store.getUsedCapacity(resource) > 0) {
        tasks = [...tasks, ...this.taskController.createTransferTask(resource, this.storage, this.factory)];
      }
    });

    if (tasks.length) {
    	this.set('lastManageStore', Game.time);
      drone.setTaskQueue(tasks);
    } else {
    	this.set('storeOkay', Game.time);
    }
	}

	produce() {
		const job = this.get('job');
		let requestedResources = this.get('requestedResources') || {};
   	const components = COMMODITIES[job.resource].components;
   	let hasComponents = this.get('hasComponents');

		if (!hasComponents) {
	   	hasComponents = Object.keys(components).reduce((acc, component) => {
				return acc && this.getUsedCapacity(component) >= components[component];
			}, true);
			if (hasComponents) this.set('hasComponents', hasComponents);
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
		}
		else if (job.lastRunTime && (job.lastRunTime + 1000 <= Game.time)) {
			Object.keys(requestedResources).forEach(resource => {
				if (this.factory.store.getUsedCapacity(resource) + this.storage.store.getUsedCapacity(resource) < requestedResources[resource]) {
					this.clearJob();
				}
			});
		}
	}

	handleJobSuccess(job, requestedResources, components) {
		job.lastRunTime = Game.time;
		if (typeof job.amount === 'number') {
			job.amount = job.amount - COMMODITIES[job.resource].amount;
			if (job.amount <= 0) job = null;
		}

		Object.keys(components).forEach(component => {
			if (typeof requestedResources[component] === 'number') {
				requestedResources[component] = requestedResources[component] - components[component];
			}
		});

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
			if (Game.time % 5 === OK) this.manageStore();

			if (!mem.job) {
				if (Game.time % 100 === OK) this.getNextJob();
				return;
			}

			if (this.factory.cooldown === OK) {
				this.produce(mem.job.resource);
			}
		} catch (e) {
			console.log(this.room.name,'factory-goof', e.toString());
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
