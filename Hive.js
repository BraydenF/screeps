const config = require('config');
const droneService = require('drone.service');
const towerService = require('tower.service');

const { INITIAL_SPAWN } = config;
const MAX_MINER_COST = 600;

class Hive {
  constructor(spawnName) {
    this.spawn = Game.spawns[spawnName];
  }

  get(key) {
    return this.spawn.memory[key];
  }

  set(key, value) {
    this.spawn.memory[key] = value;
  }

  getRoom() {
    return this.spawn.room;
  }

  getController() {
    return this.getRoom().controller;
  }

  reclaimCreep(targetId = null) {
    const toRecycle = Game.getObjectById(targetId);
    if (toRecycle) this.spawn.recycleCreep(toRecycle);
  }

  canSpawn() {
    return !this.spawn.spawning && this.spawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
  }

  spawnMiner(source) {
    if (this.canSpawn()) {
      const budget = this.getRoom().energyCapacityAvailable >= MAX_MINER_COST ? MAX_MINER_COST : this.getRoom().energyCapacityAvailable;

      const result = droneService.createDrone('miner', budget);
      if (result.status == OK) {
        // this.set('miner', result.name);
      }
    }
  }

  spawnHauler(source) {
    if (this.canSpawn()) {
      const result = droneService.createDrone('hauler', this.getRoom().energyCapacityAvailable);
      if (result.status == OK) {
        const updatedHaulers = this.get('haulers').push(result.name);
        // this.set('haulers', updatedHaulers);
      }
    }
  }

  getEnergyStatus() {
      let status;
      this.spawn.room.energyAvailable

      if (this.spawn.room.energyAvailable < 300) {
        status = 'low-energy';
      } else if (this.spawn.room.energyAvailable >= 300) {
        status = 'energized';
      } else if (this.spawn.room.energyAvailable === this.spawn.room.energyCapacityAvailable) {
        status = 'full-energy';
      }
      return status
  }

  run() {
    const upgradeContainer = this.getController().pos.findClosestByPath(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } });

    // const storage = this.spawn.pos.findClosestByPath(FIND_STRUCTURES, {
    //   filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 50
    // });
    // if (storage && this.spawn.store.getUsedCapacity(RESOURCE_ENERGY) < 300) {
    //   this.spawn.store.withdraw(storage);
    // }

    // constantly tries to heal the nearest creep
    const nearbyCreep = this.spawn.pos.findClosestByRange(FIND_MY_CREEPS, { filter: (creep) => creep.ticksToLive < 1300 });
    if (nearbyCreep && this.spawn.pos.isNearTo(nearbyCreep)) {
      nearbyCreep.memory.homeRoom = this.spawn.room.name; // takes ownership of creep
      const rechargeAttempt = this.spawn.renewCreep(nearbyCreep);
    }

    const towers = this.getRoom().find(FIND_MY_STRUCTURES, { filter: (structure) => structure.structureType === STRUCTURE_TOWER });
    towers.forEach((tower) => {
      towerService.run(tower);

      // conscripts a hauler to load the tower
      towerService.manageHauler(this, tower);
    });

    // upgrading logic
    const upgrader = this.spawn.pos.findClosestByRange(FIND_MY_CREEPS, { filter: (creep) => creep.memory.job === 'upgrader' });
    // console.log('upgrader', upgrader);
    if (upgradeContainer && this.getController().level >= 2 && !upgrader) {
      // attempt to spawn an upgrader
    }

    // handles energy resource logic
    // for (const source of this.getRoom().find(FIND_SOURCES)) {
    //   const miningTeam = new MiningTeam(this.spawn, source.id);
    //   miningTeam.run();
    // }

    // conscripts a hauler to deposit into the upgrader container
    const containerHauler = this.get('containerHauler');
    if (!containerHauler) {
      const hasLowEnergy = upgradeContainer && upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) <= 1000;
      const spawnHasEnergy = this.spawn.store.getUsedCapacity(RESOURCE_ENERGY) >= 300;

      if (hasLowEnergy && spawnHasEnergy) {
        const hauler = upgradeContainer.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.job === 'hauler' && creep.memory.task === 'unload' && !creep.memory.target
        });

        if (hauler && hauler.memory.target !== upgradeContainer.id) {
          hauler.memory.target = upgradeContainer.id;
          this.set('containerHauler', hauler.id);
          console.log(hauler, 'enlisting for duty');
        }
      }
    } else {
      // check to see if the hauler should be released from conscription
      const hauler = Game.getObjectById(containerHauler);

      if (hauler.memory.task !== 'unload') {
        this.set('containerHauler', null);
        console.log('hauler released');
      }
    }

    // 
    this.reclaimCreep('681a5bfb2b8c9d31ccaed9d9');
  }
}

module.exports = Hive;
