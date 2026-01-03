const config = require('config');
const TaskController = require('TaskController');

class PowerSpawnController {
  get taskController() {
    return this.hive.taskController;
  }

  constructor(hive) {
    this.hive = hive;
    this.spawnController = hive.spawnController;
    this.room = hive.room;
  }

  get(key) {
    return this.room.memory.powerSpawn[key];
  }

  set(key, value) {
    this.room.memory.powerSpawn[key] = value;
  }

  getPowerSpawn() {
    let powerSpawn;
    if (this.room.memory.powerSpawn) {
      powerSpawn = Game.getObjectById(this.room.memory.powerSpawn.id);
    } else {
      powerSpawn = this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } }).onFirst(f => f);
      if (powerSpawn) {
        this.room.memory.powerSpawn = { id: this.powerSpawn.id }; 
      }
    }
    return powerSpawn;
  }

  getCreep() {
    const name = this.get('creep');
    if (name && Game.creeps[name]) {
      return Game.creeps[name];
    } else {
      const creep = this.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'power' } } }).onFirst(f => f);
      if (creep) this.set('creep', creep.name);
      return creep;
    }
  }

	manageStore() {
    let loadTask = [];

    if (this.powerSpawn.store['energy'] < 3500) {
      if (this.room.storage.store['energy'] >= 1000) {
        loadTask = this.taskController.createTransferTask('energy', this.room.storage, this.powerSpawn);
      } else if (this.room.terminal && this.room.terminal.store['energy'] >= this.room.storage.store['energy']) {
        loadTask = this.taskController.createTransferTask('energy', this.room.terminal, this.powerSpawn);
      }
    }

    if (loadTask.length > 0) {
      this.taskController.issueTask(loadTask);
    }
	}

	run() {
    this.powerSpawn = this.getPowerSpawn();
		if (!this.powerSpawn) return;

		if (this.powerSpawn.store['power'] >= 1 && this.powerSpawn.store['energy'] >= 50) {
			this.powerSpawn.processPower();
		} else if (Game.time % 2 === 0) {
      const creep = this.getCreep();
      if (creep) {
        this.manageStore(); // only extra energy
      } else if (this.room.storage.store['power'] > 0) {
        const res = this.spawnController.createDrone('power', [MOVE,CARRY], { powerSpawn: this.get('id') });
        if (res.name) {
          this.set('creep', res.name);
        }
      }
		}
	}
}

module.exports = PowerSpawnController;
