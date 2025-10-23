const FACTORY_TARGET_ENERGY = 10000;

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
			// console.log(component, batchMap[component]);
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
	}

	clearJob() {
		const job = this.get('job');
		const requestedResources = this.get('requestedResources') || {};
		requestedResources[job.resource] = undefined;

		const components = FactoryController.getComponents(resource);
		Object.keys(components).forEach(component => {
			requestedResources[component] = undefined;
		});

		this.setRequestedResources(requestedResources);
		this.set('job', null);
	}

	getNextJob() {
		let job;

		// if there is a large amount of basic resources, compress them
		const compressions = {
			K: RESOURCE_KEANIUM_BAR,
			L: RESOURCE_LEMERGIUM_BAR,
			U: RESOURCE_UTRIUM_BAR,
			Z: RESOURCE_ZYNTHIUM_BAR,
			H: RESOURCE_REDUCTANT,
			O: RESOURCE_OXIDANT,
		};

		Object.keys(compressions).forEach(resource => {
			const compressedResource = compressions[resource];
			if (this.storage.store.getUsedCapacity(resource) >= 50000) {
				job = { resource: compressedResource, amount: 5000 }; // costs 25k mineral
			}
			else if (resource === 'O' && this.storage.store.getUsedCapacity(resource) >= 10000) {
				job = { resource: compressedResource, amount: 10000 }; // costs 25k mineral
			}
		});

		// if (this.factory.effects)
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
							// console.log('resource',resource);
							// const components = FactoryController.getComponents(resource);
							const batchMap = this.getBatchMap(resource);
							const batches = FactoryController.batchesProducible(batchMap);
							const maxBatches = Math.ceil(1000 / COMMODITIES[resource].cooldown);
							console.log(this.room.name, resource, batches, maxBatches);
							if (batches >= maxBatches) {
								return { resource, amount: COMMODITIES[resource].amount * 24, level: 1 };
							}
						}
				}
			}
		}

		// produce basic commodities
		const basicCommodities = {
			mist: 'condensate',
			biomass: 'cell',
			metal: 'alloy',
			silicon: 'wire',
		}

		Object.keys(basicCommodities).forEach(resource => {
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
					// limit the job size!
					job = { resource: basicCommodities[resource], amount: jobAmount * jobLimit };
				} else {
					if (mineral && batchMap[mineral] === 0) {
						// I don't have any bars, can I compress them?
						const compressionBatchMap = this.getBatchMap(mineral);
						const subBatches = FactoryController.batchesProducible(compressionBatchMap);

						if (subBatches > 0) {
							job = { resource: mineral, amount: subBatches * COMMODITIES[mineral].amount };
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
		});

		// compress energy
		if (this.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 350000) {
			job = { resource: RESOURCE_BATTERY, amount: 5000 }; // costs 25k mineral
		}

		return job;
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

	manageStore() {
		const job = this.get('job');
		const requestedResources = this.get('requestedResources') || {};
    const resources = requestedResources && Object.keys(requestedResources);

    let loadTask = [];
    let unloadTask = [];

    Object.keys(this.factory.store).forEach(resource => {
    	// console.log(this.room.name, resource, this.factory.store[resource] > requestedResources[resource] + 1000);
      if (typeof requestedResources[resource] === 'undefined' || (this.factory.store[resource] > requestedResources[resource]) + 1000 && this.room.storage.store.getFreeCapacity(resource) >= 1000) {
      	// note: consider preventing unloading until there is X if a resource; jobs could have a small requested resources amount
        unloadTask = [...unloadTask, ...this.taskController.createTransferTask(resource, this.factory, this.storage)];
        // if (unloadTask.length) this.taskController.issueTask(unloadTask);
      }
    });

    resources.forEach(resource => {
      if (requestedResources[resource] > this.factory.store[resource] && this.storage.store.getUsedCapacity(resource) > 0) {
        loadTask = [...loadTask, ...this.taskController.createTransferTask(resource, this.storage, this.factory)];
        // console.log(this.room.name, 'load-factory', resource, loadTask);
        // if (loadTask.length) this.taskController.issueTask(loadTask);
      }
    });

    if (loadTask.length || unloadTask.length) {
      this.taskController.issueTask([...loadTask, ...unloadTask]);
    }
	}

	produce(resource) {
		let job = this.get('job');
		if (!job) return;

		let requestedResources = this.get('requestedResources') || {};
   	const components = COMMODITIES[resource].components;

   	const hasComponents = Object.keys(components).reduce((acc, component) => {
			return acc && this.getUsedCapacity(component) >= components[component];
		}, true);

// console.log(this.room.name, 'factory', hasComponents, resource, this.factory.produce(resource))
		if (hasComponents) {
			job.ready = true;
			const status = this.factory.produce(resource);
			// console.log('produce', resource, status);

			if (status === OK) {
				job.lastRunTime = Game.time;
				if (typeof job.amount === 'number') {
					job.amount = job.amount - COMMODITIES[resource].amount;
					if (job.amount <= 0) job = null;
				}

				Object.keys(components).forEach(component => {
					if (typeof requestedResources[component] === 'number') {
						requestedResources[component] = requestedResources[component] - components[component];
					}
				});

			} else if (status === ERR_RCL_NOT_ENOUGH || status === ERR_INVALID_TARGET) {
				job = null;
			}
		} else if (job.lastRunTime && job.lastRunTime + 1000 >= Game.time) {
			Object.keys(requestedResources).forEach(resource => {
				if (this.factory.store.getUsedCapacity(resource) + this.storage.store.getUsedCapacity(resource) < requestedResources[resource]) {
					job = undefined;
					requestedResources = {};
				}
			});
		}

		this.set('job', job);
		this.setRequestedResources(requestedResources);
	}

	run () {
		try {
			let job = this.get('job');

			// room energy?
			if (Game.time % 10 === OK) this.manageStore();

			if (!job) {
				if (Game.time % 100 === OK) job = this.getNextJob();
				if (!job) return;
				else this.setJob(job.resource, job.amount, job.level);
			}

			if (this.factory.cooldown === OK) {
				this.produce(job.resource);
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
