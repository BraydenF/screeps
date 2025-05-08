/**
 * Base unit implementation
 */
class BaseCreep {
	constructor(creep) {
    const memory = creep.memory || {};
    this.name = creep.name;
		this.creep = creep;
    this.task = memory.task ? memory.task : 'standby';
  }

  get(key) {
    return this.creep.memory[key];
  }

  set(key, value) {
    this.creep.memory[key] = value;
  }

  hasTask(task) {
    return this.task === task;
  }

  setTask(task, message = null) {
    if (message) this.creep.say(message);
    this.set('task', task);
  }

  isStandby() {
    return !this.task || this.hasTask('standby');
  }

  enterStandby() {
    this.setTask('standby');
    this.set('target', undefined);
  }

  getFlag() {
    const flagName = this.get('flag');
    if (flagName) return Game.flags[flagName];
  }

  isEnergyEmpty() {
    return this.creep.store[RESOURCE_ENERGY] == 0;
  }

  isEnergyFull() {
    return this.creep.store.getFreeCapacity() == 0;
  }

  moveTo(target) {
    return this.creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
  }

  moveToRoom(roomName) {
    const route = Game.map.findRoute(this.creep.room, roomName);
    if (route.length > 0) {
      const exit = this.creep.pos.findClosestByRange(route[0].exit);
      return this.moveTo(exit);
    }
  }

  attack(target) {
    const status = this.creep.attack(target);
    if (status == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    }
    return status;
  }

  claim() {
    const controller = this.creep.pos.findClosestByRange(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTROLLER }});

    if (controller) {
      const status = this.creep.claimController(controller);
      if (status == ERR_NOT_IN_RANGE) {
        this.moveTo(controller);
      }
      return status;
    }
  }

  pickup(target = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);
    if (!target) {
      target = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
    }

    const status = this.creep.pickup(target);

    if (status == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } else if (status === ERR_FULL) {
      this.enterStandby();
    }

    return status;
  }

  withdraw(target, resource = RESOURCE_ENERGY) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    const withdrawAttempt = this.creep.withdraw(target, resource);
    if (withdrawAttempt == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } else if (withdrawAttempt === ERR_FULL) {
      this.enterStandby();
    }

    return withdrawAttempt;
  }

  transfer(target, resource = RESOURCE_ENERGY) {
    const status = this.creep.transfer(target, resource);
    if (status == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    }
    return status;
  }

  dropAll() {
    // drop all resources
    for (const resourceType in this.creep.carry) {
      this.creep.drop(resourceType);
    }

    this.setTask('standby');
  }

  build() {
    const targets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
    const closeTarget = this.creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);

    if ((targets && targets.length) || closeTarget) {
      // const status = this.creep.build(targets[0]);
      const status = this.creep.build(closeTarget);

      if (status === ERR_NOT_IN_RANGE) {
        this.moveTo(targets[0]);
      } else if (status === ERR_INVALID_TARGET) {
        this.enterStandby();
      }

      return status;
    }
  }

  repair() {
    const targets = this.creep.room.find(FIND_STRUCTURES, {
        filter: object => object.hits < object.hitsMax
    });

    if (targets.length > 0) {
      targets.sort((a,b) => a.hits - b.hits);
      const status = this.creep.repair(targets[0]);
      if (status === ERR_NOT_IN_RANGE) {
        this.moveTo(targets[0]);
      }
    } else {
      this.enterStandby();
    }
    return status;
  }

  upgrade() {
    const controller = this.creep.room.controller;
    const status = this.creep.upgradeController(controller);

    if (status === ERR_NOT_IN_RANGE) {
      this.moveTo(controller);
    } else if (status == ERR_NOT_ENOUGH_RESOURCES) {
      this.setTask('standby');
    }
  }

  recharge() {
    const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);

    if (spawn) {
      const rechargeAttempt = spawn.renewCreep(this.creep);
      if (rechargeAttempt === ERR_NOT_IN_RANGE) {
        this.moveTo(spawn);
      } else if (rechargeAttempt === ERR_FULL) {
        this.set('target', undefined);
        this.setTask('standby', '👉👈');
      }
    } else {
      this.moveToRoom(this.get('homeRoom'));
      // this.creep.move(RIGHT);
    }
  }

  getRandomSource() {
    const sources = this.creep.room.find(FIND_SOURCES);
    return sources.rand();
  }

  harvest(sourceId = null) {
    let source = Game.getObjectById(sourceId);

    if (!source) {
      source = this.getRandomSource();
      this.set('source', source && source.id);
    }

    const status = this.creep.harvest(source);
    switch (status) {
      case ERR_NOT_IN_RANGE:
        this.moveTo(source);
        break;

      case ERR_INVALID_TARGET:
        this.set('source', null);
        break;

      case ERR_NOT_ENOUGH_RESOURCES:
        this.enterStandby();
        break;

      case OK:
      default:
        break;
    }

    return status;
  }

  findResourceTargets(resourceAmount = 0) {
    return this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (
          structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_STORAGE
        ) && structure.store[RESOURCE_ENERGY] >= resourceAmount
      }
    });
  }

  findEmptyStorages() {
    return this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (
          structure.structureType == STRUCTURE_SPAWN ||
          structure.structureType == STRUCTURE_EXTENSION ||
          structure.structureType == STRUCTURE_TOWER ||
          structure.structureType == STRUCTURE_CONTAINER
          ) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });
  }

  clearMemory() {
    this.creep.memory = {};
  }
}

module.exports = BaseCreep;
