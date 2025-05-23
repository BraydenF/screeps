// constants reference
// LAB_MINERAL_CAPACITY: 3000,
// LAB_ENERGY_CAPACITY: 2000,
// LAB_BOOST_ENERGY: 20,
// LAB_BOOST_MINERAL: 30,
// LAB_REACTION_AMOUNT: 5,
// LAB_UNBOOST_ENERGY: 0,
// LAB_UNBOOST_MINERAL: 15,

function getStorage(hive) {
	const storages = hive.getRoom().find(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_STORAGE });
	return storages.length ? storages[0] : null;
}

class LabController {
	// a class gives more options for 
	constructor(hive) {
		this.hive = hive;
		this.labs = hive.spawn.room.find(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_LAB });
		const mem = this.hive.get(`labController`) || {};

		this.lab0 = mem.lab0 && Game.getObjectById(mem.lab0);
		this.lab1 = mem.lab1 && Game.getObjectById(mem.lab1);
		this.lab2 = mem.lab2 && Game.getObjectById(mem.lab2);

		this.storage = getStorage(hive);
		const creep = Game.creeps[mem.drone];
		this.drone = creep && new global.Drone(creep);
	}

	get(key) {
		return this.hive.get(`labController`, key);
	}

	set(key, value) {
		this.hive.set(`labController`, key);
	}

	getOpenLabs() {
		// labs not reserved for a job
	}

	reserveLabs(labs) {
		const q = new global.Queue(labs);

		if (!this.lab0 && q.length) this.lab0 = q.dequeue().id;
		if (!this.lab1 && q.length) this.lab1 = q.dequeue().id;
		if (!this.lab2 && q.length) this.lab2 = q.dequeue().id;
	}

	getDrone() {
		// add logic for appointing a drone or getting one at random for assignment.
		const creep = Game.creeps[this.get('drone')];
		return creep && new global.Drone(creep);
	}

	getFillLabTask(lab, resource) {
		return [
			{ name: 'load', target: storage, resource: resource },
  		{ name: 'unload', target: lab, resource: resource },
		];
	}

	getEmptyLabTask(lab) {
		// determine resource from the lab
		let resource;
		return [
  		{ name: 'unload', target: lab, resource: resource },
			{ name: 'load', target: storage, resource: resource },
		];
	}

	unloadLabs() {
		// empties all labs
		if (drone && !drone.hasTaskQueued()) {
			if (this.lab0 && this.lab0.mineralType) {
				console.log('lab0 - attempting unloading');
				const steps = emptyLab(lab0);
				this.getDrone().setTaskQueue(steps);
			}
			else if (this.lab1 && this.lab1.mineralType) {
				console.log('lab1 - attempting unloading');
				const steps = emptyLab(lab1);
				this.getDrone().setTaskQueue(steps);
			}
			else if (this.lab2 && this.lab2.mineralType) {
				console.log('lab2 - attempting unloading');
				const steps = emptyLab(lab2);
				this.getDrone().setTaskQueue(steps);
			} else {
				console.log('job is done');
				mem.job = null;
			}
		}
	}

	run() {
		if (Game.time % 10) {
			this.reserveLabs(this.labs);
		}

		const job = this.get('job');
		if (!job) return; // nothing to do;

		switch (expression) {
			case 'run':
				const [resource1, resource2] = job.resource.split('');
				const lab1Ready = this.lab1.store.getUsedCapacity(resource1) >= LAB_REACTION_AMOUNT;
				const lab2Ready = this.lab2.store.getUsedCapacity(resource2) >= LAB_REACTION_AMOUNT;
				const labsReady = lab1Ready && lab2Ready;

				if (!labsReady && (job.status === 'starting' || job.status === 'loading')) {
					// fill the labs
					const resource1Available = this.storage.store.getUsedCapacity(resource1) >= job.amount;
					const resource2Available = this.storage.store.getUsedCapacity(resource2) >= job.amount;

					if (!lab1Ready && resource1Available) {
						const steps = this.getFillLabTask(lab1, resource1, job.amount);
						if (drone && !drone.hasTaskQueued()) {
							if (job.status !== 'loading') job.status = 'loading';
							console.log(hive.spawn.name, 'loading lab1');
							drone.setTaskQueue(steps);
						}
					} else if (!lab2Ready && resource2Available) {
						const steps = this.getFillLabTask(lab2, resource2, job.amount);
						if (drone && !drone.hasTaskQueued()) {
							if (job.status !== 'loading') job.status = 'loading';
							console.log(hive.spawn.name, 'loading lab2');
							drone.setTaskQueue(steps);
						}
					}

				} else if (labsReady) {
					// run the reaction
					const status = lab0.runReaction(lab1, lab2);

					if (status === OK) {
						if (job.status !== 'running') job.status = 'running';
					}
				} else {
					// console.log('job is done');
					// mem.job = null;
					// I should allow for shifting into a boost job at the end.
					if (job.boost) {
						const previousJobAmount = job.amount; // could I check the lab instead?
						console.log('here?', lab0);
						// job = { action: 'boost', target: null, resource: amount: previousJobAmount };
						// mem.job = job;
					}
				}
				break;

			case 'reverse':
				// can I run the reaction in question?
				const hasMats = this.lab0.store.getUsedCapacity(job.resource) >= LAB_REACTION_AMOUNT;

				if (!hasMats && (job.status === 'starting' || job.status === 'loading')) {
					// attempt to gather mats
					const storedResources = this.storage.store.getUsedCapacity(job.resource);
					if (!job.amount && storedResources >= LAB_REACTION_AMOUNT) {
						job.amount = storedResources - (storedResources % LAB_REACTION_AMOUNT);
					}

					if (storedResources >= job.amount) {
						// issue task to move resources from the storage.
						// which creep will do this?
						const steps = this.getFillLabTask(lab0, job.resource, job.amount);
						if (drone && !drone.hasTaskQueued()) {
							if (job.status !== 'loading') job.status = 'loading';
							drone.setTaskQueue(steps);
						}
					} else {
						// not enough resources
					}
				} else if (hasMats) {
					// reverse the reaction
					const status = lab0.reverseReaction(lab1, lab2);

					if (status === OK) {
						if (job.status !== 'running') job.status = 'running';
					}
				} else {
					// cleanup stage - trigger 
					if (job.status !== 'unloading') job.status = 'unloading';
				}
				break;

			case 'boost':
				break;

			case 'unboost':
				// unboost creep
				break;

			default:
				break;
		}

		if (job.status === 'unloading') {
			this.unloadLabs();
		}
	}
}

const labController = {
	getInputs: function(resource) {
		// finds the input ingredients for the suggested resource
		switch(resource) {
			case 'GH':
				return ['G', 'H'];
			case 'GO':
				return ['G', 'O'];
		}
	},
	startLabFactory: function(spawn) {
		return function startLab(action, resource, amount) {
			const newJob = { action: action, resource: resource, amount: amount, status: 'starting' };
			spawn.memory['labController'].job = newJob;
		}
	},
	run: function(hive) {
		const mem = hive.get('labController') || { job: null, };
		const labs = hive.spawn.room.find(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_LAB });

		function reserveLabs(labs) {
			const q = new global.Queue(labs);

			if (!mem.lab0 && q.length) mem.lab0 = q.dequeue().id;
			if (!mem.lab1 && q.length) mem.lab1 = q.dequeue().id;
			if (!mem.lab2 && q.length) mem.lab2 = q.dequeue().id;
		}

		if (Game.time % 10) {
			reserveLabs(labs); // the labs are stored in memory for lookup
			hive.set('labController', mem);
		}

		if (!mem.job) {
			// todo: I could automate the ZH job to som degree here.
			// if I have no job what should I do?
			// empty out the containers?
			// issues a job request of some kind?
			// //
			return;
		}
		let job = mem.job;

		// todo: dynamic lab reservation
		// function getOpenLabs() {
		// 	const openLabs = [];
		// 	labs.forEach(lab => {
		// 		// if (mem.lab0 !== lab.id) 
		// 	});
		// 	return openLabs;
		// }
		// const openLabs = getOpenLabs();

		const lab0 = mem.lab0 && Game.getObjectById(mem.lab0);
		const lab1 = mem.lab1 && Game.getObjectById(mem.lab1);
		const lab2 = mem.lab2 && Game.getObjectById(mem.lab2);
		const storage = getStorage(hive);
		// todo: check the terminal for resources as well.
		const creep = Game.creeps[mem.drone];
		const drone = creep && new global.Drone(creep);

		function fillLab(lab, resource, amount) {
			return [
  			{ name: 'unload', target: storage.id },
				{ name: 'load', target: storage.id, resource: resource, amount: amount },
    		{ name: 'unload', target: lab.id, resource: resource },
			];
		}
		function emptyLab(lab) {
			return [
  			{ name: 'unload', target: storage.id },
	  		{ name: 'load', target: lab.id, resource: lab.mineralType },
				{ name: 'unload', target: storage.id, resource: lab.mineralType },
			];
		}

		if (job.action === 'reverse') {
			// can I run the reaction in question?
			const hasMats = lab0.store.getUsedCapacity(job.resource) >= LAB_REACTION_AMOUNT;

			if (!hasMats && (job.status === 'starting' || job.status === 'loading')) {
				// attempt to gather mats
				const storedResources = storage.store.getUsedCapacity(job.resource);
				if (!job.amount && storedResources >= LAB_REACTION_AMOUNT) {
					job.amount = storedResources - (storedResources % LAB_REACTION_AMOUNT);
				}

				if (storedResources >= job.amount) {
					// issue task to move resources from the storage.
					// which creep will do this?
					const steps = fillLab(lab0, job.resource, job.amount);
					if (drone && !drone.hasTaskQueued()) {
						if (job.status !== 'loading') job.status = 'loading';
						drone.setTaskQueue(steps);
					}
				} else {
					// not enough resources
				}
			} else if (hasMats) {
				// todo: empty the secondary labs when they are over X threshold
				// 		refill lab0 to prolong the reaction.

				// manages the resources in the labs when jobs are larger than a single inventory size.
				if (job.amount > 3000) {
					const droneCapacity = drone && drone.creep.store.getCapacity();
					const storedResources = storage.store.getUsedCapacity(job.resource);

					if (lab1.store.getUsedCapacity(lab1.mineralType) >= droneCapacity && !drone.hasTaskQueued()) {
						const steps = emptyLab(lab1, lab1.mineralType, droneCapacity);
						drone.setTaskQueue(steps);
					} else if (lab2.store.getUsedCapacity(lab2.mineralType) >= droneCapacity  && !drone.hasTaskQueued()) {
						const steps = emptyLab(lab2, lab2.mineralType, droneCapacity);
						drone.setTaskQueue(steps);
					} else if (lab0.store.getFreeCapacity(lab0.mineralType) > droneCapacity && storedResources >= droneCapacity && !drone.hasTaskQueued()) {
						// add more resources to the lab
						const steps = fillLab(lab0, job.resource, job.amount);
						drone.setTaskQueue(steps);
					}
				}

				// reverse reaction
				const status = lab0.reverseReaction(lab1, lab2);

				if (status === OK) {
					if (job.status !== 'running') job.status = 'running';
				}
			} else {
				// cleanup stage - trigger 
				if (job.status !== 'unloading') job.status = 'unloading';
			}
		} else if (job.action === 'run') {
			const [resource1, resource2] = job.resource.split('');
			const lab1Ready = lab1.store.getUsedCapacity(resource1) >= LAB_REACTION_AMOUNT;
			const lab2Ready = lab2.store.getUsedCapacity(resource2) >= LAB_REACTION_AMOUNT;
			const labsReady = lab1Ready && lab2Ready;

			if (!labsReady && (job.status === 'starting' || job.status === 'loading')) {
				// fill the labs
				const resource1Available = storage.store.getUsedCapacity(resource1) >= job.amount;
				const resource2Available = storage.store.getUsedCapacity(resource2) >= job.amount;

				if (!lab1Ready && resource1Available) {
					const steps = fillLab(lab1, resource1, job.amount);
					if (drone && !drone.hasTaskQueued()) {
						if (job.status !== 'loading') job.status = 'loading';
						console.log(hive.spawn.name, 'loading lab1');
						drone.setTaskQueue(steps);
					}
				} else if (!lab2Ready && resource2Available) {
					const steps = fillLab(lab2, resource2, job.amount);
					if (drone && !drone.hasTaskQueued()) {
						if (job.status !== 'loading') job.status = 'loading';
						console.log(hive.spawn.name, 'loading lab2');
						drone.setTaskQueue(steps);
					}
				}

			} else if (labsReady) {
				// run the reaction
				const status = lab0.runReaction(lab1, lab2);

				if (status === OK) {
					if (job.status !== 'running') job.status = 'running';
				}
			} else {
				console.log('job is done');
				if (job.boost) {
					const previousJobAmount = job.amount; // could I check the lab instead?
					job = { action: 'boost', target: null, resource: job.resource, amount: previousJobAmount };
					mem.job = job;
				} else {
					mem.job = null;
				}
			}
		} else if (job.action === 'boost') {
			// I should probably check all of the labs to see if they happen to have the correct material			
			const labReady = lab0.store.getUsedCapacity(job.resource) >= LAB_BOOST_ENERGY;

			if (!labReady && (job.status === 'starting' || job.status === 'loading')) {
				// fill the labs
				const resourceAvailable = storage.store.getUsedCapacity(job.resource) >= job.amount;
				console.log('resourceAvailable', resourceAvailable, storage.store.getUsedCapacity(job.resource), job.amount);

				if (!labReady && resourceAvailable) {
					const steps = fillLab(lab0, job.resource, job.amount);
					if (drone && !drone.hasTaskQueued()) {
						if (job.status !== 'loading') job.status = 'loading';
						console.log(hive.spawn.name, 'loading lab1');
						drone.setTaskQueue(steps);
					}
				}
			} else if (labReady) {
				// run the reaction
				let target = job.target && Game.creeps[job.target];
				console.log('boost target', target);
				const status = lab0.boostCreep(target);
				console.log('boost', status);

				if (status === OK) {
					if (job.status !== 'running') job.status = 'running';
				} else if (status === ERR_NOT_IN_RANGE) {
					console.log('not in range');
					if (drone.isStandby() || !drone.hasTask('recharge')) {
						drone.setTask('boosting');
						drone.setTarget(lab0);
					} else if (drone.hasTask('boosting')) {
						let status = drone.moveTo(lab0);
						console.log('boosting', status);
					}
				} else if (status === ERR_NOT_ENOUGH_RESOURCES) {
					drone.enterStandby();
					job.status = 'unloading';
				} else if (status === ERR_NOT_FOUND || status === ERR_INVALID_TARGET) {
					drone.enterStandby();
					job.target = null;
					job.note = 'target rejected';
				}
			} else {
				// console.log('job is done');
				// mem.job = null;
			}
		} else if (job.action === 'unboost') {
			// unboost creep
		}

		// empties all labs
		if (job.action === 'cleanup' || job.status === 'unloading') {
			if (drone && !drone.hasTaskQueued()) {
				if (lab0 && lab0.mineralType) {
					console.log('lab0 - attempting unloading');
					const steps = emptyLab(lab0);
					drone.setTaskQueue(steps);
				}
				else if (lab1 && lab1.mineralType) {
					console.log('lab1 - attempting unloading');
					const steps = emptyLab(lab1);
					drone.setTaskQueue(steps);
				}
				else if (lab2 && lab2.mineralType) {
					console.log('lab2 - attempting unloading');
					const steps = emptyLab(lab2);
					drone.setTaskQueue(steps);
				} else {
					console.log('job is done');
					mem.job = null;
				}
			}
		}

		hive.set('labController', mem);
	},
}

module.exports = labController;
