const TaskController = require('TaskController');
const productionNotifier = require('productionNotifier');

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

// 
/**
 * the current amount of X indicates the max job request size
 * If GH2O is available, run the labs
 * If note, request it. 
 * 
 * 
 * When/where do I make G?
 * I have enough ZK and UL
 * When do I make ZK - the Z room requests K
 * When do I make UL - the L room requests U
 * - Do I blend these two to make the G?
 */

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

				// I could set the mode to unboost here.
				if (!labMem[lab.id]) labMem[lab.id] = {};
				idleLab.memory = labMem[lab.id];
			}
		});

		return idleLab;
	}

	get taskController() {
		return this.hive && this.hive.taskController;
	}

	constructor(hive) {
		this.hive = hive;
		this.room = hive.room;

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

	getOperableLab() {
		const mem = this.room.memory['labController'] || {}

		if (mem.labs) {
			for (const labId of mem.labs) {
				// const lab = Game.getObjectById(labId);
				// if (lab && lab.)
			}
		}
		// this.labs.forEach(lab => {
		// 	if (lab && lab.cooldown === OK && !mem[lab.id].task) {
		// 		return lab.unboostCreep(creep);
		// 	}
		// });
		// search for a lab that should be boosted.
		// start with just X labs
		// Ideally it has operated reecently
		return null;
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

	boostCreep(creep) {

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

		if (!mem.storeTask) {
			mem.nextManageStore = Game.time + 125;
			if (mem.mode === 'load') {
				const resourceAvailable = this.storage.store.getUsedCapacity(mem.resource) >= LAB_REACTION_AMOUNT;
				if (lab.mineralType && lab.mineralType !== mem.resource) {
					// console.log('unloading', lab, lab.mineralType);
					mem.storeTask = this.taskController.createTransferTask(lab.mineralType, lab, this.storage);
				} else if (resourceAvailable && resourceAmount < amount) {
					// console.log('loading', lab, mem.resource);
					mem.storeTask = this.taskController.createTransferTask(mem.resource, this.storage, lab);
				} else {
					mem.nextManageStore = Game.time + 256;
				}
			} else if (mem.mode === 'unload') {
				if ((resourceAmount > amount || lab.mineralType && lab.mineralType !== mem.resource)) {
					mem.storeTask = this.taskController.createTransferTask(lab.mineralType, lab, this.storage);
				}
			} else if (!mem.resource && lab.mineralType && lab.store[lab.mineralType] > 0) {
				// console.log('unloading', lab, lab.mineralType);
				mem.storeTask = this.taskController.createTransferTask(lab.mineralType, lab, this.storage);
			} else {
				mem.nextManageStore = Game.time + 256;
			}
		}
	}

	processTask(lab, { task, resource, lab1: lab1Id, lab2: lab2Id, target: targetCreep, amount, limit }) {
		const job = this.get('job');
		const [resource1, resource2] = LabController.getResourceComponents(resource);
		const lab1 = lab1Id && Game.getObjectById(lab1Id);
		const lab2 = lab2Id && Game.getObjectById(lab2Id);
		let status;

		switch (task) {
			case 'run':
				const lab1Resources = lab1 ? lab1.store.getUsedCapacity(resource1) : 0;
				const lab2Resources = lab1 ? lab2.store.getUsedCapacity(resource2) : 0;
				const lab1Ready = lab1Resources >= LAB_REACTION_AMOUNT;
				const lab2Ready = lab2Resources >= LAB_REACTION_AMOUNT;


				// limit
				if (limit && this.storage.store[resource] >= limit) {
					// console.log('limit skip');
					break;
				}

				if (lab.cooldown === OK && lab1Ready && lab2Ready && lab.store.getFreeCapacity(resource) >= LAB_REACTION_AMOUNT) {
					status = lab.runReaction(lab1, lab2);
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
						productionNotifier.incrementCounter(resource, LAB_REACTION_AMOUNT);
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
					status = lab.reverseReaction(lab1, lab2);
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
					// this.boostCreep(targetCreep, resource);
					status = lab.boostCreep(targetCreep);

					if (status === OK) {
						// creep was boosted successfully.
						// if (targetCreep.body.reduce((acc, part) => part.type === WORK && part.boost ? true : acc, false)) {
						targetCreep.memory.boosted = lab.id; // records the lab to return resources
						targetCreep.memory.target = null;
						targetCreep.memory.task = 'standby';
						break;
						// }
					} else if (status === ERR_NOT_ENOUGH_RESOURCES) {
						targetCreep.memory.target = null;
						targetCreep.memory.task = 'standby';
					} else if (status === ERR_NOT_FOUND || status === ERR_INVALID_TARGET) {
						targetCreep.memory.target = null;
						targetCreep.memory.task = 'standby';
					}
				}
				break;
		}

		if (job && job.resource === resource) {
			// temporarily negates changes to the job from non primary tasks
			this.set('job', job);
		}

		return status;
	}

	processLabs() {
		const labs = this.get('labs') || {};
		// NOTE: if a lab is not in memory, it can not deboost creeps

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
			const mem = labs[labId];
			if (mem && (mem.nextRun || 0) <= Game.time) {
				const lab = Game.getObjectById(labId);
				if (!lab) return;

				if (lab.store.getFreeCapacity('energy') >= 1000) {
					this.room.memory.labEnergy[labId] = lab.store.getFreeCapacity('energy');
				}

				if (this.hive.taskController && !mem.storeTask && (mem.nextManageStore || 0) <= Game.time) {
					// instead of issueing tasks, I need the labs to announce they have needs
					this.manageStore(lab, mem);
				}

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
					if (lab.cooldown === OK) {
						this.processTask(lab, mem);
					} else {
						mem.nextRun = Game.time + lab.cooldown;
					}
				}

				labs[lab.id] = mem;
			}
		});
		this.set('labs', labs);
	}

	run() {
		try {
			this.processLabs();
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
