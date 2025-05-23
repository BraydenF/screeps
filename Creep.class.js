const config = require('config');
const Queue = global.Queue;

/**
 * Base unit implementation
 */
class BaseCreep {
	constructor(creep) {
    const memory = creep.memory || {};
    this.name = creep.name;
		this.creep = creep;
    this.task = memory.task ? memory.task : 'standby';
    this.taskQueue = new Queue(memory.taskQueue);
  }

  get(key) {
    return this.creep.memory[key];
  }

  // getAsObject(key) {
  //   return this.get(key) && Game.getObjectById(this.get(key));
  // }

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

  getTaskQueue() {
    return this.taskQueue;
  }

  setTaskQueue(tasks) {
    this.taskQueue = new Queue(tasks);
    this.set('taskQueue', tasks);
  }

  pushTask(task) {
    this.taskQueue.enqueue(task);
  }

  hasTaskQueued() {
    return !this.taskQueue.isEmpty;
  }

  isStandby() {
    return !this.task || this.hasTask('standby');
  }

  enterStandby(message) {
    if (message) this.creep.say(message);
    this.setTask('standby');
    this.set('target', undefined);
    this.set('resource', undefined);
    this.set('amount', undefined);
  }

  getTarget() {
    return Game.getObjectById(this.get('target'));
  }

  setTarget(target) {
    if (typeof target === 'object' && target.id) target = target.id;
    if (typeof target === 'string') {
      this.set('target', target);
    }
  }

  getFlag() {
    const flagName = this.get('flag');
    if (flagName) return Game.flags[flagName];
  }

  getSpawn() {
    const homeroom = Game.rooms[this.get('homeRoom')];
    const homeSpawn = homeroom && homeroom.find(FIND_MY_SPAWNS);
    const spawn = homeSpawn && homeSpawn[0] || this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    return spawn;
  }

  isHome() {
    return this.creep.room.name === this.get('homeRoom');
  }

  isEnergyEmpty() {
    return this.creep.store[RESOURCE_ENERGY] == 0;
  }

  isEnergyFull() {
    return this.creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0;
  }

  getHarvestPower() {
    return this.creep.body.reduce((acc, part) => {
      if (part.type === WORK) {
        // if (part.boost) console.log(part.type, part.boost, part.boost && BOOSTS[WORK][part.boost].harvest);
        if (part.boost && BOOSTS[WORK][part.boost]) {
          acc = acc + BOOSTS[WORK][part.boost].harvest;
        } else {
          acc = acc + HARVEST_POWER;
        }
      }
      return acc;
    }, 0);
  }

  moveTo(target) {
    if (!target.pos || this.creep.pos.roomName === target.pos.roomName) {
      return this.creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
    } else {
      const route = Game.map.findRoute(this.creep.pos.roomName, target.pos.roomName, {
        routeCallback(roomName) {
          let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
          let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
          let isMyRoom = Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller.my;

          if (isHighway || isMyRoom) {
            return 1;
          } else if (config.roomsToAvoid.includes(roomName)) {
            return 99;
          } else {
            return 2.5;
          }
        }
      });

      if (route.length > 0) {
        const exit = this.creep.pos.findClosestByRange(route[0].exit);
        return this.moveTo(exit);
      }
    }
  }

  moveToRoom(roomName) {
    const route = Game.map.findRoute(this.creep.room, roomName, { avoid: config.roomsToAvoid });
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
      // console.log('claim', status)
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

  withdraw(target, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    const withdrawAttempt = this.creep.withdraw(target, resource, amount);
    if (withdrawAttempt == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } else if (withdrawAttempt === ERR_FULL || withdrawAttempt === ERR_NOT_ENOUGH_RESOURCES) {
      this.enterStandby();
    }

    return withdrawAttempt;
  }

  transfer(target, resource = RESOURCE_ENERGY, amount = null) {
    const status = this.creep.transfer(target, resource, amount);
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

    this.enterStandby();
  }

  build() {
    const targets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
    const closeTarget = this.creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);

    if ((targets && targets.length) || closeTarget) {
      const status = this.creep.build(closeTarget);

      if (status === ERR_NOT_IN_RANGE) {
        this.moveTo(closeTarget);
      } else if (status === ERR_INVALID_TARGET || status === ERR_NOT_ENOUGH_RESOURCES) {
        this.enterStandby();
      }

      return status;
    } else {
      this.enterStandby();
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
      return status;
    } else {
      this.enterStandby();
    }
  }

  upgrade() {
    const controller = this.creep.room.controller;
    const status = this.creep.upgradeController(controller);

    if (status === ERR_NOT_IN_RANGE) {
      this.moveTo(controller);
    } else if (status == ERR_NOT_ENOUGH_RESOURCES) {
      this.enterStandby();
    }
  }

  recharge() {
    const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (spawn) {
      const rechargeAttempt = spawn.renewCreep(this.creep);
      if (rechargeAttempt === ERR_NOT_IN_RANGE) {
        this.moveTo(spawn);
      } else if (rechargeAttempt === ERR_FULL) {
        this.enterStandby('👉👈');
      } else if (rechargeAttempt === OK) {
        this.transfer(spawn, RESOURCE_ENERGY);
      }
    } else {
      this.moveToRoom(this.get('homeRoom'));
    }
  }

  getRandomSource() {
    const sources = this.creep.room.find(FIND_SOURCES);
    return sources.rand();
  }

  canHarvest() {
    const harvestPower = this.getHarvestPower();
    const carryCount = this.creep.getActiveBodyparts(CARRY);
    const freeCapacity = this.creep.store.getFreeCapacity(RESOURCE_ENERGY);

    const willCreepOverflow = freeCapacity === 0 || freeCapacity < harvestPower
    const canHarvest = (!carryCount && !this.isEnergyFull()) || (carryCount && !willCreepOverflow);

    return canHarvest;
  }

  harvest(target = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      target = this.getRandomSource();
      this.set('source', target && target.id);
    }

    const status = this.creep.harvest(target);
    // console.log(this.creep.name, 'harvest', status);
    switch (status) {
      case ERR_NOT_IN_RANGE:
        this.moveTo(target)
        // console.log('moveto', this.moveTo(target));
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

  findStorage () {
    // I should use th 
    const spawn = this.getSpawn();
    return spawn.pos.findClosestByPath(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_STORAGE });
  }

  findEnergizedStorage () {
    const freeCapacity = this.creep.store.getFreeCapacity(RESOURCE_ENERGY);
    return this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store.getUsedCapacity(RESOURCE_ENERGY) > freeCapacity
    });
  }

  // new task type
  energyTransfer() {
    // identifies the best location for getting energy
    // moves the energy into the designated target.

    // 

  }

  load(target = null, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);
    const creepCapacity = this.creep.store.getFreeCapacity();
    const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

    if (target) {
      const status = this.withdraw(target, resource, amount);
      if (status == ERR_INVALID_TARGET) this.set('target', undefined);
      return status;
    }

    if (droppedResources) {
      const piledResources = this.creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource) => resource.amount >= creepCapacity,
      });

      if (piledResources && piledResources.length) {
        return this.pickup(piledResources[0]);
      } else {
        return this.pickup();
      }
    }

    if (!target) {
      // finds the Storage with enough energy
      target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] >= creepCapacity
      });
    }

    if (!target) {
      // finds the closest spawn
      target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => (structure.structureType == STRUCTURE_SPAWN) && structure.store[RESOURCE_ENERGY] >= 50,
      });
    }

    if (target) {
      const status = this.withdraw(target, resource, amount);
      return status;
    }
  }

  unload(target = null, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      // the drone may have strayed out of the room
      if (this.creep.room !== this.get('homeRoom')) {
        this.moveToRoom(this.get('homeRoom'));
      }
    }

    if (!target) {
      const targets = this.findEmptyStorages();
      if (targets && targets[0]) target = targets[0];
    }

    if (!target) {
      // the drone may have strayed out of the room
      if (this.creep.room !== this.get('homeRoom')) {
        this.moveToRoom(this.get('homeRoom'));
      } else {
        // moves to spawn for passive recharge and locality
        this.moveTo(this.creep.room.spawn);
      }
    }

    const result = this.transfer(target, resource, amount);
    if (result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_FULL || result === ERR_INVALID_TARGET) {
      this.enterStandby();
    }

    return result;
  }

  siege() {
    const hostileCreep = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    const warTargets = this.creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
      filter: (struct) => {
        return true;
      }
    });

    let target = hostileCreep ? hostileCreep : warTargets;
    const status = this.attack(target);
    console.log('siege:status', status);
    return status;
  }

  keepAlive() {
    if (this.creep.getActiveBodyparts(CLAIM) === 0 && this.get('task') !== 'recharge') {
      // allows for a creep to finish deliving resources
      if (this.creep.ticksToLive < 350) {
        this.enterStandby();
        this.setTask('recharge', '❤️‍🩹');
      } else {
        const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
        if (this.creep.ticksToLive <= 500 && this.creep.pos.getRangeTo(spawn) <= 5) {
          this.enterStandby();
          this.setTask('recharge', '❤️‍🩹');
        }
      }
    }
  }

  clearMemory() {
    this.creep.memory = {};
  }

  runTask() {
    try {
      const spawn = this.getSpawn();
      let target = this.get('target');
      let resource = this.get('resource');
      let amount = this.get('amount');
      const flag = this.getFlag();

      // if (this.creep.name === 'drone-69654890-chan') {
      //   // I am getting put into standby mode improperly and losing my target;
      //   console.log('-----------------------------------------------');
      //   console.log(this.creep.name, this.task, target, resource);
      // }

      // task queue
      if ((this.task === 'queue' || this.hasTask('standby')) && this.hasTaskQueued()) {
        const queue = this.getTaskQueue();
        const task = queue.peek();
        if (typeof task === 'object') {
          if (task.name) {
            this.task = task.name;
            this.setTask(task.name);
            if (task.target) {
              target = task.target;
              this.setTarget(task.target);
            }
            if (task.resource) {
              resource = task.resource;
              this.set('resource', task.resource);
            }
          }
          queue.dequeue();
        } else if (typeof task === 'string') {
          this.task = queue.dequeue();
        }
      }

      // if (this.isStandby()) console.log(this.name, 'is in standby');
      // basic task operation
      switch (this.task) {
        case 'pickup':
          const source = Game.getObjectById(this.get('source'));
          const energyNearSource = source && source.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

          if (energyNearSource && energyNearSource.pos.isNearTo(source)) {
            this.pickup(energyNearSource);
          } else {
            const targetedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: { id: target }});
            this.pickup(targetedResources);
          }
          break;

        case 'load':
          this.load(target, resource, amount);
          break;

        case 'unload':
          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
                || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            });
          }

          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => structure.structureType == STRUCTURE_TOWER && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 500
            });
          }

          const upgradeContainer = spawn.memory.upgradeContainer && Game.getObjectById(spawn.memory.upgradeContainer);
          if (!target && upgradeContainer && upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) <= 800) {
            target = upgradeContainer;
          }

          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => structure.structureType == STRUCTURE_LAB && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
          }

          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => structure.structureType == STRUCTURE_TERMINAL && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 10000
            });
          }

          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
          }

          if (!target) {
            // delivers resources to a worker in need
            target = this.creep.pos.findClosestByPath(FIND_MY_CREEPS, {
              filter: (creep) => {
                const loadingWorker = creep.memory.job !== 'hauler' && (creep.memory.task === 'load' || creep.memory.task === 'pickup' || creep.memory.task === 'harvest');
                const assistingUpgrader = creep.memory.job === 'drone' && creep.memory.task === 'upgrade';
                return loadingWorker || assistingUpgrader;
              },
            });
          }

          const status = this.unload(target, resource, amount);
          break;

        case 'drop': 
          this.dropAll();
          break;

        case 'harvest':
          if (this.canHarvest()) {
            this.harvest(target || this.get('source'));
          } else {
            this.enterStandby();
          }
          break;

        case 'build':
          this.build();
          break;

        case 'upgrade':
          this.upgrade();
          break;

        case 'repair':
          this.repair();
          break;

        case 'energyTransfer':
          this.energyTransfer();
          break;

        case 'recharge':
          this.recharge();
          break;

        case 'attack':
          this.siege();
          break;

        case 'claim':
          this.claim();
          break;

        case 'flag':
          if (flag) {
            const status = this.moveTo(flag);
            const distanceToFlag = this.creep.pos.getRangeTo(flag);
            if (distanceToFlag <= 3) {
              if (flag.memory.task) this.setTask(flag.memory.task);
              if (flag.memory.source) this.set('source', flag.memory.source);
            }
          } else {
            this.set('flag', undefined);
            this.enterStandby('No flags for me');
          }
          break;

        case 'boosting':
          if (target) this.moveTo(Game.getObjectById(target));
          break;

        case 'standby':
        default:
          // do nothing
          // todo: what can I do here about standby?
          break;
      }
    } catch (e) {
      throw e;
      console.log(this.creep.name,'failed task', e);
    }
  }
}

module.exports = BaseCreep;
