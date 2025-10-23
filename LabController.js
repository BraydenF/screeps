const TaskController = require('TaskController');

// constants reference
// LAB_MINERAL_CAPACITY: 3000,
// LAB_ENERGY_CAPACITY: 2000,
// LAB_BOOST_ENERGY: 20,
// LAB_BOOST_MINERAL: 30,
// LAB_REACTION_AMOUNT: 5,
// LAB_UNBOOST_ENERGY: 0,
// LAB_UNBOOST_MINERAL: 15,

/** Lab Notes */
// revserse -> GO, ZH, UH
// run -> GH
// boost -> GH
// 

// Tha lab can support multiple jobs after level 2
// OH can be crafted and applied as a sub reaction; to use 5 labs only
const upgradeBoosts = ['XGH2O', 'GH2O', 'GH'];

class LabController {
	static startLabFactory(room) {
		return function startJob(action, resource, amount) {
			const newJob = { action: action, resource: resource, amount: amount, status: 'starting' };
			room.memory['labController'].job = newJob;
		}
	}

	static getResourceComponents(resource) {
		if (resource.includes('X')) {
			return ['X', resource.substring(1)];
		} else if (resource.includes('2')) {
			return [resource.slice(0, 2), 'OH'];
		} else if (resource === 'G') {
			return ['ZK', 'UL'];
		} else {
			return resource.split('');
		}
	}

	static findIdleLab(room) {
		const labMem = room.memory['labController'].labs || {};
		let idleLab;

		room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }).forEach(lab => {
			if (lab.cooldown === OK && (!labMem[lab.id] || !labMem[lab.id].task)) {
				idleLab = lab;
				idleLab.memory = labMem[lab.id];
			}
		});

		return idleLab;
	}

	get taskController() {
		return this.hive.taskController;
	}

	constructor(room) {
		this.room = room;
		this.hive = global.hives[room.roomName];

		if (typeof this.room.memory['labController'] === 'undefined') this.room.memory['labController'] = { labs: {} };
		const mem = this.room.memory['labController'];
		if (!mem.labs) mem.labs = {};

		// todo: remove manual lab numbering
		this.lab0 = Game.getObjectById(mem.lab0);
		this.lab1 = Game.getObjectById(mem.lab1);
		this.lab2 = Game.getObjectById(mem.lab2);

		this.storage = this.room.storage;
		this.labs = this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } });
	    // global[room.name.toLowerCase()].runLab = LabController.startLabFactory(this.room);
	}

	get(key) {
		const mem = this.room.memory['labController'];
		return mem[key];
	}

	set(key, value) {
		this.room.memory['labController'][key] = value;
	}

	labReserved(labId) {
		const labs = this.get('labs') || {};
		return labs[labId];
	}

	reserveLab(labId, config) {
		const labs = this.get('labs') || {};
		labs[labId] = config;
		this.set('labs', labs);
	}

	clearReservations(arg) {
		const labs = this.get('labs') || {};

		if (typeof arg === 'string') {
			labs[arg] = undefined;
		} else if (Array.isArray(arg)) {
			arg.forEach(id => labs[id] = undefined);
		}

		this.set('labs', labs);
	}

	getIdleLabs() {
		return _.pickBy(this.labs, lab => !(lab.task || lab.mode));
	}

	setJob(action, resource, amount = null) {
		this.set('job', { action, resource, amount, status: 'starting' });
		// a job could have a subtask
	}

	getDrone() {
		const drones = this.room.find(FIND_MY_CREEPS, { filter: (creep) => {
			const drone = creep.memory.job === 'drone';
			const hauler = creep.memory.job === 'hauler' && !(creep.memory.source || creep.memory.targetRoom);
			if (drone || hauler) {
				const drone = new global.Drone(creep);
				return !drone.hasTaskQueued();
			}
		}});

		return drones.length > 0 ? new global.Drone(drones[0]) : null;
	}

	unboostCreep(creep) {
		const mem = this.get('labs');

		this.labs.forEach(lab => {
			if (lab && lab.cooldown === OK && !mem[lab.id].task) {
				return lab.unboostCreep(creep);
			}
		});

		return ERR_TIRED;
	}

	loadLab(lab, resource, amount) {
		const task = this.taskController.createTransferTask(resource, this.storage, lab);
    return this.taskController.issueTask(task, '➕⚗️');
	}

	unloadLab(lab) {
		const task = this.taskController.createTransferTask(lab.mineralType, lab, this.storage);
    return this.taskController.issueTask(task, '➖⚗️');
	}

	unloadLabs() {
		if (this.lab0 && this.lab0.mineralType) {
			this.unloadLab(this.lab0);
		} else if (this.lab1 && this.lab1.mineralType) {
			this.unloadLab(this.lab1);
		} else if (this.lab2 && this.lab2.mineralType) {
			this.unloadLab(this.lab2);
		} else {
			return true;
		}
	}

	getNextJob() {
		let job = this.get('job');

		if (job && job.prevJob) {
			return job.prevJob;
		}

		if (this.storage.store.getUsedCapacity('KO') >= 500) {
			return { action: 'reverse', resource: 'KO', amount: 500, status: 'starting' };
		} 
		else if (this.storage.store.getUsedCapacity('ZH') >= 500) {
			return { action: 'reverse', resource: 'ZH', amount: 500, status: 'starting' };
		}
		else if (this.storage.store.getUsedCapacity('GO') >= 500) {
			return { action: 'reverse', resource: 'GO', amount: this.storage.store.getUsedCapacity('GO'), status: 'starting' };
		}
		else if (this.storage.store.getUsedCapacity('ZK') >= 500 && this.storage.store.getUsedCapacity('UL') >= 500) {
			return { action: 'run', resource: 'G', amount: 500, status: 'starting' };
		}
		else if (this.storage.store.getUsedCapacity('G') >= 500 && this.storage.store.getUsedCapacity('H') >= 500) {
			return { action: 'run', resource: 'GH', amount: 500, status: 'starting' };
		}

		// if (this.storage.store.getUsedCapacity('G') >= 1000 && this.storage.store.getUsedCapacity('H') >= 1000) {
		// 	return { action: 'run', resource: 'GH', amount: 1000, status: 'starting' };
		// }

		// if controller level >= 7
		if (this.room.controller.level >= 7) {

			if (this.storage.store.getUsedCapacity('O') >= 1000 && this.storage.store.getUsedCapacity('H') >= 1000) {
				// could I make the determination here that I would like to run a subtask?
				// let subtask;
				// if (this.storage.store.getUsedCapacity('GO') >= 3000) {
				// 	subtask = { action: 'reverse', resource: 'GO', amount: this.storage.store.getUsedCapacity('GO'), status: 'starting' };
				// }
				return { action: 'run', resource: 'OH', amount: 1000, status: 'starting' };
			}

			// { action: 'run', resource: 'GH2O', amount: 3000, status: 'starting' }
		}

		// if controller level >= 8
		// { action: 'run', resource: 'XGH2O', amount: 3000, status: 'starting' }

		return null;
	}

	issueTasks() {
		// determine what sort of things we can make, and assign the labs with tasks based on that. 
		// I should make up some configurations that I know work first such as...
		// - GO / GH / OH
		const mem = this.get('labs');

		// const idleLab = this.findIdleLab()
		// get the labs that are currently unused.
		// - 

		// The first task will be to process invader loot
		const idleLabs = LabController.getIdleLabs();
		if (this.room.controller.level >= 7 && idleLabs.length > 0) {
			// focus on what I want to do first
			// GH2O
			const ghCount = this.storage.store.getUsedCapacity('GH');
			const ohCount = this.storage.store.getUsedCapacity('OH');
			if (this.storage.store.getUsedCapacity('GH') > 1000) {
				// const [] = LabController.getResourceComponents();

				if (idleLabs.length >= 3 && this.storage.store.getUsedCapacity('OH') > 1000) {
					this.reserveLab(idleLabs[1], { mode: 'load', resource: 'GH'});
					this.reserveLab(idleLabs[2], { mode: 'load', resource: 'OH' });
					this.reserveLab(idleLabs[0], {
						mode: 'unload',
						action: 'run',
						resource: 'GH2O',
						loadAmount: 1500,
						lab1: idleLabs[1].id,
						lab2: idleLabs[2].id,
					});
				} else if (idleLabs.length >= 5 && this.storage.store.getUsedCapacity('O') > 1000 && this.storage.store.getUsedCapacity('H') > 1000) {
					this.reserveLab(idleLabs[1], { mode: 'load', resource: 'GH'});
					this.reserveLab(idleLabs[5], { mode: 'load', resource: 'O'});
					this.reserveLab(idleLabs[6], { mode: 'load', resource: 'H'});
					this.reserveLab(idleLabs[2], {
						mode: 'unload',
						action: 'run',
						resource: 'OH',
						loadAmount: 1500,
						lab1: idleLabs[3].id,
						lab2: idleLabs[4].id,
					});
					this.reserveLab(idleLabs[0], {
						mode: 'unload',
						action: 'run',
						resource: 'GH2O',
						loadAmount: 1500,
						lab1: idleLabs[1].id,
						lab2: idleLabs[2].id,
					});
					// if (idleLabs[5]) {
					// 	this.reserveLab(idleLabs[5], {
					// 		mode: 'unload',
					// 		action: 'run',
					// 		resource: 'OH',
					// 		lab1: idleLabs[3].id,
					// 		lab2: idleLabs[4].id,
					// 	});
					// }
				}
			} else if (this.storage.store.getUsedCapacity('G') > 1000) {

			}

			const zhCap = this.storage.store.getUsedCapacity('ZH');
			const uhCap = this.storage.store.getUsedCapacity('UH');
			if (zhCap >= 1000 && uhCap >= 1000) {
				 // { action: 'reverse', resource: 'ZH', amount: zhCap };
				 // { action: 'reverse', resource: 'UH', amount: uhCap };
			}
		}
	}

	manageStore(lab, mem) {
		const resourceAmount = lab.store[mem.resource];
		const amount = mem.fillAmount ? Number(mem.fillAmount) : mem.mode === 'load' ? 50 : 1000;
		const drone = mem.drone && Game.getObjectById(mem.drone);

		if (drone && drone.memory.taskQueue && drone.memory.taskQueue.length > 0) {
			return; // the drone is probably working on my task
		} else if (drone && drone.memory.task === 'standby') {
			mem.drone = undefined;
		}

		if (mem.mode === 'load') {
			const resourceAvailable = this.storage.store.getUsedCapacity(mem.resource) >= LAB_REACTION_AMOUNT;
			if (!drone && lab.mineralType && lab.mineralType !== mem.resource) {
				mem.drone = this.unloadLab(lab);
			} else  if (!drone && resourceAvailable && resourceAmount < amount) {
				mem.drone = this.loadLab(lab, mem.resource);
			} else if (drone && resourceAmount >= amount) {
				mem.drone = undefined;
			}
		} else if (mem.mode === 'unload') {
			if (!drone && (resourceAmount > amount || lab.mineralType && lab.mineralType !== mem.resource)) {
				mem.drone = this.unloadLab(lab);
			} else if (drone && resourceAmount <= amount) {
				mem.drone = undefined;
			}
		} else if (!mem.resource && lab.mineralType && lab.store[lab.mineralType] > 0) {
			mem.drone = this.unloadLab(lab);
		}
	}

	processTask(lab, { task, resource, lab1: lab1Id, lab2: lab2Id, target: targetCreep, amount }) {
		const job = this.get('job');
		const [resource1, resource2] = LabController.getResourceComponents(resource);
		const lab1 = lab1Id && Game.getObjectById(lab1Id);
		const lab2 = lab2Id && Game.getObjectById(lab2Id);

		switch (task) {
			case 'run':
				const lab1Ready = lab1 && lab1.store.getUsedCapacity(resource1) >= LAB_REACTION_AMOUNT;
				const lab2Ready = lab2 && lab2.store.getUsedCapacity(resource2) >= LAB_REACTION_AMOUNT;

				if (lab.cooldown === OK && lab1Ready && lab2Ready) {
					const status = lab.runReaction(lab1, lab2);
					if (job) job.status = 'running';

					if (status === OK) {
						// updates the job amount
						if (job && typeof job.amount === 'number') {
							job.amount = job.amount - LAB_REACTION_AMOUNT;
							if (job.amount < 0) {
								job.status = 'unloading';
								this.clearReservations([this.lab0.id, this.lab1.id, this.lab2.id]);
							}
						}
					} else if (status === ERR_RCL_NOT_ENOUGH) {
						if (job) job.status = 'unloading';
						this.clearReservations([lab.id, lab1Id, lab2Id]);
					} else {
						console.log(this.room.name, lab.id, 'lab-status', status);
					}
				}
				break;

			case 'reverse':
				const labReady = lab.store.getUsedCapacity(resource) >= LAB_REACTION_AMOUNT;

				if (lab.cooldown === OK && labReady) {
					const status = lab.reverseReaction(lab1, lab2);
					if (job) job.status = 'running';

					if (status === OK) {
						if (job && job.status !== 'running') job.status = 'running';
						if (job && typeof job.amount === 'number') {
							job.amount = job.amount - LAB_REACTION_AMOUNT;
							if (job.amount < 0) {
								job.status = 'unloading';
								this.clearReservations([lab.id, lab1Id, lab2Id]);
							}
						}
					} else {
						// console.log(lab.id, 'lab-status', status);
					}
				}
				break;

			case 'boost':
				targetCreep = typeof targetCreep === 'string' && Game.creeps[targetCreep];
				if (targetCreep && lab.cooldown === OK && lab.store.getUsedCapacity(resource) >= LAB_REACTION_AMOUNT) {
					const status = lab.boostCreep(targetCreep);

					if (status === OK) {
						// I cam probably move the logic here, but it stays where it is at for now
					} else if (status === ERR_NOT_ENOUGH_RESOURCES) {
						targetCreep.memory.target = null;
						targetCreep.memory.task = 'standby';
					} else if (status === ERR_NOT_FOUND || status === ERR_INVALID_TARGET) {
						targetCreep.memory.target = null;
						targetCreep.memory.task = 'standby';
					}

					// creep was boosted successfully.
					if (targetCreep.body.reduce((acc, part) => part.type === WORK && part.boost ? true : acc, false)) {
						targetCreep.memory.target = null;
						targetCreep.memory.task = 'standby';
						break;
					}
				}
				break;
		}

		if (job && job.resource === resource) {
			// temporarily negates changes to the job from non primary tasks
			this.set('job', job);
		}
	}

	processLabs() {
		const labs = this.get('labs') || {};

		// if there is an upgrader, try to boost it.
		let upgrader = null;
		if (this.room.controller.level < 8) {
			upgrader = this.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'upgrader' } } }).reduce((acc, upgrader) => {
				const hasBoost = upgrader.body.reduce((acc, part) => part.type === WORK && part.boost ? true : acc, false);
				if (upgrader.ticksToLive > 1450 && !hasBoost) {
					return upgrader;
				}
				return acc;
			}, null);
		}

		if (!this.room.memory.labEnergy) this.room.memory.labEnergy = {};
		Object.keys(labs).forEach(labId => {
			const lab = Game.getObjectById(labId);
			const mem = labs[lab.id];
			if (lab.store.getFreeCapacity('energy') >= 1000) this.room.memory.labEnergy[labId] = lab.store.getFreeCapacity('energy');

			if (lab && mem) {
				// update to use a manageStore function
				this.manageStore(lab, mem);

				if (mem.target) {
					const targetCreep = Game.creeps[mem.target];

					// creep was boosted successfully.
					if (targetCreep && targetCreep.body.reduce((acc, part) => part.type === WORK && part.boost ? true : acc, false)) {
						targetCreep.memory.target = null;
						targetCreep.memory.task = 'standby';
						mem.target = undefined;

						if (mem.prevTask) {
							mem.task = mem.prevTask;
							mem.prevTask = undefined;
						}
					} else if (!targetCreep || targetCreep.ticksToLive < 1350) {
						mem.target = undefined;
						if (mem.prevTask) {
							mem.task = mem.prevTask;
							mem.prevTask = undefined;
						}
					}
				} else if (!mem.target && this.room.controller.level < 8 && upgrader && upgradeBoosts.includes(mem.resource) && lab.store[mem.resource] > LAB_BOOST_ENERGY) {
					upgrader.memory.target = lab.id;
					mem.task = 'boost';
					mem.prevTask = 'run';
					mem.target = upgrader.name;
				}

				if (mem.task) {
					this.processTask(lab, mem);
				}

				labs[lab.id] = mem;
			}
		});

		this.set('labs', labs);
	}

	run() {
		try {
			this.processLabs();

			let job = this.get('job');

			if (!job) {
				// if (Game.time % 25 === OK && this.room.controller.level === 6) {
				// 	job = this.getNextJob();
				// 	if (job) this.set('job', job);
				// }
				// return;
			}

			if (job) {
				const resourceAvailable = this.storage.store.getUsedCapacity(job.resource);
				switch (job.action) {
					case 'run':
						const [resource1, resource2] = LabController.getResourceComponents(job.resource);
						const resource1Available = this.storage.store.getUsedCapacity(resource1);
						const resource2Available = this.storage.store.getUsedCapacity(resource2);

						if (!job.status || (job.status === 'starting' || job.status === 'loading')) {
							// validate the job inputs.
							if (resource1Available && resource2Available)	 {
								job.status = 'loading';

								this.reserveLab(this.lab1.id, { mode: 'load', resource: resource1 });
								this.reserveLab(this.lab2.id, { mode: 'load', resource: resource2 });
								this.reserveLab(this.lab0.id, {
									task: 'run',
									mode: 'unload',
									resource: job.resource,
									lab1: this.lab1.id,
									lab2: this.lab2.id,
									fillAmount: 1500,
								});
							} else {
								// invalid job
								job.status = 'unloading';
								this.clearReservations([this.lab0.id, this.lab1.id, this.lab2.id]);
								break;
							}
						}
						break;

					case 'reverse':
						if (job.status === 'starting') {
							// validate the job inputs.
							if (resourceAvailable)	 {
								job.status = 'loading';
								this.reserveLab(this.lab1.id, { mode: 'unload' });
								this.reserveLab(this.lab2.id, { mode: 'unload' });
								this.reserveLab(this.lab0.id, {
									task: 'reverse',
									mode: 'load',
									resource: job.resource,
									lab1: this.lab1.id,
									lab2: this.lab2.id,
								});
							} else {
								// invalid job
								this.set('job', null);
								break;
							}
						}
						break;

					case 'boost':
						// new logic for boosting creeps from a job is necessary
						break;

					case 'cleanup':
						const labsEmpty = this.unloadLabs();
						if (labsEmpty) job = this.getNextJob();
						break;

					default:
						break;
				}

				if (job && job.status === 'unloading') {
					const labsEmpty = this.unloadLabs();
					if (labsEmpty) job = this.getNextJob();
				}
				this.set('job', job);
			}

		} catch (e) {
			console.log(this.room.name, 'lab-oopsy', e.toString());
		}
	}

	report() {
	  const labs = this.get('labs') || {};
	  const message = Object.keys(labs).reduce((acc, labId) => {
	    const mem = labs[labId];
	    if (mem && mem.task) return acc + `[${mem.task} : ${mem.resource}] `;
	    return acc;
	  }, '');
	  if (message.length > 0) {
	    console.log('<b>Lab Report:</b>', message);
	  }
	}
}

module.exports = LabController;
