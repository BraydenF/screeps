const config = require('config');
const TaskController = require('TaskController');

class PowerSpawnController {
  get taskController() {
    return this.hive.taskController;
  }

  constructor(spawn) {
    this.spawn = spawn;
    this.room = spawn.room;
    this.hive = global.hives[this.room.roomName];

    if (this.room.memory.powerSpawn) {
      this.powerSpawn = Game.getObjectById(this.room.memory.powerSpawn.id);
    } else {
      this.powerSpawn = this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } }).onFirst(f => f);
      if (this.powerSpawn) {
        this.room.memory.powerSpawn = { id: this.powerSpawn.id }; 
      }
    }
  }

  get(key) {
    return this.room.memory.powerSpawn[key];
  }

  set(key, value) {
    this.room.memory.powerSpawn[key] = value;
  }

  getCreep() {
    const name = this.get('creep');
    if (name && Game.creeps[name]) {
      return Game.creeps[name];
    } else {
      const creep = this.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'power' } } });
      if (creep) this.set('creep', creep.name);
      return creep;
    }
  }

  // todo: create a specific creep to manage the spawn when there is energy
	manageStore() {
    let loadTask = [];

    // if (this.powerSpawn.store['power'] <= 50 && this.room.storage.store['power'] > 0) {
    // 	loadTask = this.taskController.createTransferTask('power', this.room.storage, this.powerSpawn);
    //   loadTask.push(this.taskController.createUnloadTask(this.room.storage, 'power'));
    // }

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
		if (!this.powerSpawn) return;
    const mem = this.get('powerSpawn');

		if (this.powerSpawn.store['power'] >= 1 && this.powerSpawn.store['energy'] >= 50) {
			this.powerSpawn.processPower();
		} else if (Game.time % 1 === 0){
      const creeps = this.getCreep();
      // console.log('creep', creeps && creeps[0])
      if (creeps.length > 0) {
        this.manageStore(); // only extra energy
      } else if (this.room.storage.store['power'] > 0) {
        this.spawn.createDrone('power', [MOVE,CARRY], { powerSpawn: this.get('id') })
      }
		}
	}

}

module.exports = PowerSpawnController;
