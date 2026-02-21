const config = require('config');
const TaskController = require('TaskController');

class PowerSpawnController {
  get room () {
    return Game.rooms[this.roomName];
  }

  constructor(hive) {
    this.spawnController = hive.spawnController;
    this.taskController = hive.taskController;
    this.factoryController = hive.factoryController;
    this.roomName = hive.roomName;
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
      const creep = this.room.find(FIND_MY_CREEPS, { filter: { memory: { powerSpawn: this.room.memory.powerSpawn.id } } }).onFirst(f => f);
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

	run(factoryController) {
    if ((this.get('_nextPowerSpawn') || 0) <= Game.time) {
      this.powerSpawn = this.getPowerSpawn();
      if (!this.powerSpawn) return;

      if (this.powerSpawn.store['power'] >= 1 && this.powerSpawn.store['energy'] >= 50) {
        this.powerSpawn.processPower();
      } else {
        return this.set('_nextPowerSpawn', Game.time + 11);
      }

      const powerStored = this.room.storage.store['power'];
      const energyStored = this.room.storage.store['energy'];

      if (powerStored > 0 && Game.time % 33 === 0) {
        if (energyStored > 50000 && Game.cpu.bucket >= 8500) {
          if (!this.getCreep()) {
            const res = this.spawnController.createDrone('steward', [...m10c10, ...m10c10], { powerSpawn: this.get('id') });
            if (res.name) {
              this.set('creep', res.name);
            }
          }
        }

        if (powerStored > 1000 && energyStored < 35000 && this.room.storage.store['battery'] > 25000) {
          if (factoryController && factoryController.isAcceptingJobs()) {
            factoryController.setJob('energy', 10000);
          }
        }
      }
    }
	}
}

module.exports = PowerSpawnController;
