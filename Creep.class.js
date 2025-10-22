const config = require('config');
const Queue = global.Queue;
const GameMap = require('GameMap');
const LabController = require('LabController');

/**
 * Base unit implementation
 */
class BaseCreep {
  get parts() {
    return this.creep.body.reduce((parts, part) => {
      parts[part.type] = (parts[part.type] || 0) + 1
      return parts;
    }, { total: this.creep.body.length });
  }

  get room() {
    return this.creep.room;
  }

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

  set(key, value) {
    this.creep.memory[key] = value;
  }

  hasTask(task) {
    return this.task === task;
  }

  setTask(task, target = null, message = null) {
    this.set('task', task);
    if (target) this.setTarget(target);
    if (message) this.creep.say(message);
  }

  getTaskQueue() {
    return this.taskQueue;
  }

  setTaskQueue(tasks, message) {
    this.taskQueue = new Queue(tasks);
    this.set('taskQueue', tasks);
    if (message) this.creep.say(message);
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
    this.set('target', null);
    this.set('resource', undefined);
    this.set('amount', undefined);
    this.set('_move', undefined);
  }

  getSource() {
    const srcId = this.get('source');
    return srcId && Game.getObjectById(srcId);
  }

  getTarget() {
    return Game.getObjectById(this.get('target'));
  }

  setTarget(target) {
    if (typeof target === 'object' && target.id) target = target.id;
    if (typeof target === 'string') {
      this.set('target', target);
    } else if (!target) {
      this.set('target', null)
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

  getFreeCapacity(resource = RESOURCE_ENERGY) {
    return this.creep.store.getFreeCapacity(resource);
  }

  getUsedCapacity(resource = RESOURCE_ENERGY) {
    return this.creep.store.getUsedCapacity(resource);
  }

  getStoreLevel() {
    return this.creep.store.getUsedCapacity() / this.creep.store.getCapacity();
  }

  isEmpty() {
    return this.creep.store.getUsedCapacity() === 0;
  }

  isFull() {
    return this.creep.store.getFreeCapacity() === 0;
  }

  isEnergyEmpty() {
    return this.creep.store[RESOURCE_ENERGY] === 0;
  }

  isEnergyFull() {
    return this.getFreeCapacity(RESOURCE_ENERGY) === 0;
  }

  getFirstResource() {
    const resources = Object.keys(this.creep.store);
    return resources.length > 0 ? resources[0] : undefined;
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
    if (this.creep.name === 'hauler-73490406-chan') console.log('target', target);
    if (typeof target === 'string') target = Game.getObjectById(target);
    if (typeof target === 'number') {
      const exit = this.creep.pos.findClosestByRange(target);
      return this.creep.moveTo(exit, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
    }

    if (target.pos && this.creep.room.name === target.pos.roomName) {
      if (this.creep.fatigue === OK) {
        return this.creep.moveTo(target, { reusePath: 3, visualizePathStyle: { stroke: '#ffffff' } });
      } else {
        Game.map.visual.line(this.creep.pos, target.pos, { width: 0.3 });
        return ERR_TIRED;
      }
    } else {
      const route = GameMap.findRoute(this.creep.room.name, target && (target.roomName || target.pos.roomName));

      if (route.length > 0) {
        const exit = this.creep.pos.findClosestByPath(route[0].exit);
        // if (this.get('targetRoom') === 'E6N56') console.log('route.length', route.length);
        if (route.length >= 2) {
          // console.log('111')
          return this.creep.moveTo(exit, { reusePath: 15, visualizePathStyle: { stroke: '#ffffff' } });
        } else {
          const ret = PathFinder.search(this.creep.pos, exit, {
            maxRooms: 2,
          });
          // console.log('ret', ret.path[0]);
          return this.creep.move(this.creep.pos.getDirectionTo(ret.path[0]));
        }
      }
    }
  }

  moveToRoom(roomName) {
    const route = GameMap.findRoute(this.creep.room, roomName);
    if (route.length > 0) {
      return this.moveTo(route[0].exit);
    }
  }

  attack(target) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target && !this.creep.pos.isNearTo(target)) {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const status = this.creep.attack(target);
    if (status == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } if (status === ERR_INVALID_TARGET) {
      this.enterStandby();
    }
    // console.log('attaack-stat', status);

    return status;
  }

  rangedAttack(target) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    // console.log('rangedattack', target, this.creep.pos.inRangeTo(target, 3));
    if (target && !this.creep.pos.inRangeTo(target, 3)) {
      const status = this.creep.moveTo(target);
      console.log('asdsad', status)
      return ERR_NOT_IN_RANGE;
    } else if (!target) {
      this.enterStandby();
    }

    const status = this.creep.rangedAttack(target);
    if (status == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    }

    return status;

  }

  attackController(room) {
    if (this.creep.room.name === room) {
      const controller = this.creep.room.controller;
      if (this.creep.pos.isNearTo(controller)) {
        const status = this.creep.attackController(controller);
        // if (status === OK) this.enterStandby();
        if (status === ERR_INVALID_TARGET) this.setTask('reserve');
      } else {
        this.moveTo(controller);
        return ERR_NOT_IN_RANGE;
      }
    } else {
      this.moveToRoom(room);
      return ERR_NOT_IN_RANGE;
    }
  }

  reserve(room) {
    if (this.creep.room.name === room) {
      const controller = this.creep.room.controller;
      if (this.creep.pos.isNearTo(controller)) {
        const status = this.creep.reserveController(controller);
        // if (status === OK) this.enterStandby();
      } else {
        this.moveTo(controller);
        return ERR_NOT_IN_RANGE;
      }
    } else {
      this.moveToRoom(room);
      return ERR_NOT_IN_RANGE;
    }
  }

  claim(room) {
    if (this.creep.room.name === room) {
      const controller = this.creep.room.controller;
      if (this.creep.pos.isNearTo(controller)) {
        const status = this.creep.claimController(controller);
        if (status === OK) this.enterStandby();
      } else {
        this.moveTo(controller);
        return ERR_NOT_IN_RANGE;
      }
    } else {
      this.moveToRoom(room);
      return ERR_NOT_IN_RANGE;
    }
  }

  pickup(target = null) {
    if (!target) target = this.getTarget();
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      target = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
    }

    if (target && !this.creep.pos.isNearTo(target)) {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const status = this.creep.pickup(target);

    if (status == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } else if (status === ERR_FULL || status === ERR_INVALID_TARGET) {
      this.enterStandby();
    }

    return status;
  }

  withdraw(target, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target && !this.creep.pos.isNearTo(target)) {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const withdrawAttempt = this.creep.withdraw(target, resource, amount);
    if (withdrawAttempt == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } else if (withdrawAttempt === ERR_FULL || withdrawAttempt === ERR_NOT_ENOUGH_RESOURCES || withdrawAttempt === ERR_INVALID_TARGET) {
      this.enterStandby();
    }
    return withdrawAttempt;
  }

  transfer(target, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target && !this.creep.pos.isNearTo(target)) {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

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

  build(target = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    // todo: check the room for a build queue

    if (!target) {
      target = this.creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    }

    if (target) {
      // max range is 3; shortened to reduce issues in cramped rooms
      if (target && !this.creep.pos.inRangeTo(target, 2)) {
        this.moveTo(target);
        return ERR_NOT_IN_RANGE;
      }

      const status = this.creep.build(target);
      // console.log('build', target, status);

      if (status === ERR_NOT_IN_RANGE) {
        this.moveTo(target);
      } else if (status === ERR_INVALID_TARGET || status === ERR_NOT_ENOUGH_RESOURCES) {
        this.enterStandby();
      }

      return status;
    } else {
      this.enterStandby(); // nothing to build
    }
  }

  repair(target = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      target = this.creep.room.find(FIND_STRUCTURES, {
          filter: object => object.hits < object.hitsMax
      }).sort((a,b) => a.hits - b.hits).onFirst(t => t);
    }

    if (target && !this.creep.pos.inRangeTo(target, 3)) {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const status = this.creep.repair(target);
    if (status === ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } else if (status === ERR_INVALID_TARGET || status === ERR_NOT_ENOUGH_RESOURCES) {
      this.enterStandby();
    }
    return status;
  }

  upgrade() {
    const controller = this.creep.room.controller;
    const status = this.creep.upgradeController(controller);

    if (controller && !this.creep.pos.inRangeTo(controller, 3)) {
      this.moveTo(controller);
      return ERR_NOT_IN_RANGE;
    }

    if (status === ERR_NOT_IN_RANGE) {
      this.moveTo(controller);
    } else if (status === ERR_NOT_ENOUGH_RESOURCES || status === ERR_NOT_OWNER) {
      this.enterStandby();
    }
  }

  recharge() {
    // todo: creeps should grab energy from the container if possible to recharge. Otherwise they may need to let themselves die.
    // 
    const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (spawn) {
      if (spawn && !this.creep.pos.isNearTo(spawn)) {
        this.moveTo(spawn);
        return ERR_NOT_IN_RANGE;
      }

      if (spawn.room.energyAvailable > 0) {
        const rechargeAttempt = spawn.renewCreep(this.creep);

        if (rechargeAttempt === ERR_NOT_IN_RANGE) {
          this.moveTo(spawn);
        } else if (rechargeAttempt === ERR_FULL) {
          this.enterStandby('👉👈');
        } else if (rechargeAttempt === OK) {
          this.transfer(spawn, RESOURCE_ENERGY);
        }
      } else if (spawn.room.energyAvailable === 0 && this.creep.ticksToLive > 800) {
        this.enterStandby('shucks');
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

    const creepWillOverflow = freeCapacity === 0 || harvestPower > freeCapacity;
    const canHarvest = (!carryCount && !this.isEnergyFull()) || (carryCount && !creepWillOverflow);

    return canHarvest;
  }

  harvest(target = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      target = this.getRandomSource();
      this.setTarget(target.id);
    }

    if (target && !this.creep.pos.isNearTo(target)) {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const status = this.creep.harvest(target);
    switch (status) {
      case ERR_NOT_IN_RANGE:
        this.moveTo(target)
        break;

      case ERR_INVALID_TARGET:
        this.set('target', null);
        break;

      case ERR_NOT_ENOUGH_RESOURCES:
        this.enterStandby();
        break;

      case OK:
        // const onHarvestStr = this.get('onHarvest');
        // if (onHarvestStr) {
          // I am a miner getting energy from an external room
          // const onHarvestFunc = Function(onHarvestStr);
          // if (onHarvestFunc) onHarvest();
        // }
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

  findLowEnergyStore(structures, energyAmount = 200) {
    if (energyAmount) {
      return structures.reduce((acc, structure) => !acc && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= energyAmount ? structure : acc, null);
    } else {
      return structures.reduce((acc, structure) => !acc && structure.store.getUsedCapacity(RESOURCE_ENERGY) < energyAmount ? structure : acc, null);
    }
  }

  getStorage () {
    const spawn = this.getSpawn();
    return spawn && spawn.room.storage;
  }

  // new task type
  energyTransfer() {
    // identifies the best location for getting energy
    // moves the energy into the designated target.

    // 

  }

  load(target = null, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target) {
      const status = this.withdraw(target, resource, amount);
      if (status == ERR_INVALID_TARGET) this.set('target', undefined);
      return status;
    }
  }

  unload(target = null, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      // the drone may have strayed out of the room
      if (this.creep.room !== this.get('homeRoom')) {
        this.moveToRoom(this.get('homeRoom'));
      } else {
        const targets = this.findEmptyStorages();
        if (targets && targets[0]) target = targets[0];
      }
    } else if (target && !this.creep.pos.isNearTo(target)) {
      // if (this.creep.name === 'hauler-74242875-chan' 
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const status = this.transfer(target, resource, amount);
    // console.log('unload', target, resource, status)
    if (status === ERR_NOT_ENOUGH_RESOURCES || status === ERR_FULL || status === ERR_INVALID_TARGET) {
      this.enterStandby();
    }

    return status;
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
    return status;
  }

  keepAlive() {
    // I need to change to use less recharge.
    // this.creep.get('legend'); allow legends to recharge
    // if (this.creep.getActiveBodyparts(CLAIM) > 0 || this.get('job') === 'miner' || this.get('job') === 'soldier') {
    //   return;
    // }

    // const spawn = this.getSpawn();
    // if (this.get('task') !== 'recharge' && spawn) {
    //   // allows for a creep to finish deliving resources
    //   if (this.creep.ticksToLive < 350) {
    //     this.enterStandby();
    //     this.setTask('recharge', null, '❤️‍🩹');
    //   } else {
    //     const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    //     if (this.creep.ticksToLive <= 500 && this.creep.pos.getRangeTo(spawn) <= 5) {
    //       this.enterStandby();
    //       this.setTask('recharge', null, '❤️‍🩹');
    //     }
    //   }
    // }
  }

  eolSequence() {
    const nearDeath =  this.creep.ticksToLive <= 100;
    if (nearDeath && this.get('job') === 'upgrader' && !this.hasTask('unboost') && !this.hasTask('recharge')) {
      const isBoosted = nearDeath && this.creep.body.reduce((acc, part) => part.type === WORK && part.boost ? true : acc, false);

      if (nearDeath && isBoosted && this.isEmpty()) {
        const idleLab = LabController.findIdleLab(this.creep.room);

        if (idleLab) {
          this.enterStandby();
          this.setTask('unboost', idleLab.id); 
        }
      }
      return;
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

      // basic task operation
      switch (this.task) {
        case 'moveTo':
          this.moveTo(target);
          if (this.creep.pos.getRangeTo(target) === 0) this.enterStandby();
          break;

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
          if (!target) {
            const salvage = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
              filter: tombstone => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
            });
            if (salvage) {
              target = salvage.id;
              this.setTarget(target);
            }
          }

          this.load(target, resource, amount);
          break;

        case 'unload':
          // nothing to unload or target the is full
          if (Object.keys(this.creep.store).length === 0) this.enterStandby();
          else if (target && target.store && target.store.getFreeCapacity() === 0) this.enterStandby();

          // non energy resources default to storage.
          if (resource && resource !== 'energy' && !target) {
            target = this.getStorage();
          } else if (!target) {
            // how can I best prevent this search with out adding it to too many ticks

            if (!target && this.creep.room.energyCapacityAvailable - this.creep.room.energyAvailable > 50) {
              target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
                  || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
              });
            }

            if (!target && this.creep.room.memory.tEnergy) {
              const lowEnergyTowers = Object.keys(this.creep.room.memory.tEnergy).map(id => Game.getObjectById(id));
              const nearestTower = lowEnergyTowers.length > 0 ? this.creep.pos.findClosestByRange(lowEnergyTowers) : null;
              if (nearestTower) target = nearestTower; 
            }

            const spawnRoom = spawn && spawn.room;
            const upgradeContainer = spawnRoom.memory.upgradeContainer && Game.getObjectById(spawnRoom.memory.upgradeContainer);
            if (!target && upgradeContainer && upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) <= 1800) {
              target = upgradeContainer;
            }

            if (!target && this.creep.room.memory.labEnergy) {
              const lowEnergyLabs = Object.keys(this.creep.room.memory.labEnergy).map(id => Game.getObjectById(id));
              // const labs = this.creep.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } });
              // const lowEnergyLab = this.findLowEnergyStore(labs);
              // if (lowEnergyLab) target = lowEnergyLab;
              const nearestLab = this.creep.pos.findClosestByRange(lowEnergyLabs);
              if (nearestLab) {
                if (nearestLab.store.getFreeCapacity('energy') >= 500) {
                  target = nearestLab;
                } else {
                  this.creep.room.memory.labEnergy[nearestLab.id] = undefined;
                }
              }
            }

            const terminal = this.creep.room.terminal;
            if (!target && terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
              target = terminal;
            }

            const factory = this.creep.room.memory.factory && Game.getObjectById(this.creep.room.memory.factory.id);
            if (!target && factory && factory.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
              target = factory;
            }

            const storage = this.creep.room.storage;
            if (!target && storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
              target = storage;
            }

            // only haulers will hand off resources
            if (!target && this.get('job') === 'hauler' && this.room.controller.level < 7) {
              // delivers resources to a worker in need
              target = this.creep.pos.findClosestByPath(FIND_MY_CREEPS, {
                filter: (creep) => {
                  const assistingRecharge = creep.memory.task === 'recharge';
                  const loadingUpgrader = creep.memory.job === 'upgrader' && creep.memory.task === 'upgrade';
                  const assistingDrone = creep.memory.job === 'drone' && creep.memory.task === 'build';
                  return assistingRecharge || assistingDrone || loadingUpgrader;
                },
              });
            }

            if (!target && terminal && terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 10000) {
              target = terminal;
            }
          }


          if (target && !this.getTarget()) this.setTarget(target);
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
          this.build(target);
          break;

        case 'upgrade':
          this.upgrade();
          break;

        case 'repair':
          this.repair(target);
          break;

        case 'transfer':
          this.transfer(this.get('targetStore'));
          break;

        case 'energyTransfer':
          this.energyTransfer();
          break;

        case 'recharge':
          this.recharge();
          break;

        case 'reclaim':
          if (!this.creep.pos.isNearTo(spawn)) this.moveTo(spawn);
          else spawn.recycleCreep(this.creep);
          break;

        case 'attack':
          this.attack(this.get('target'));
          break;

        case 'range-attack':
          this.rangedAttack(this.get('target'));
          break;

        case 'siege':
          const siegeTarget = this.get('targetRoom');
          if (this.creep.room.name === siegeTarget) {
            this.siege();
          } else {
            this.moveTo(siegeTarget);
          }
          break;

        case 'heal':
          const woundedCreeps = this.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: creep => creep.hits < creep.hitsMax })
            .sort((a, b) => a.hits > b.hits);
          const woundedCreep = this.creep.pos.findClosestByRange(FIND_MY_CREEPS, { filter: creep => creep.hits < creep.hitsMax });
          if (woundedCreep) {
            if (woundedCreeps.length > 0 && this.creep.pos.isNearTo(woundedCreeps[0])) {
              this.creep.heal(woundedCreeps[0]);
            } else if (this.creep.pos.isNearTo(woundedCreep)) {
              this.creep.heal(woundedCreep);
            } else {
              if (woundedCreeps.length > 0) this.creep.rangedHeal(woundedCreeps[0]);
              this.moveTo(woundedCreep);
            }
          } else {
            this.enterStandby();
          }
          break;

        case 'attackController':
          this.attackController(this.get('targetRoom'));
          break;

        case 'reserve':
          this.reserve(this.get('targetRoom'));
          break;

        case 'claim':
          this.claim(this.get('targetRoom'));
          break;

        case 'flag':
          if (flag) {
            const status = this.moveTo(flag);
            const distanceToFlag = this.creep.pos.getRangeTo(flag);
            if (distanceToFlag <= 5) {
              if (flag.memory.task) this.setTask(flag.memory.task);
              if (flag.memory.source) this.setTarget(flag.memory.source);
            }
          } else {
            this.set('flag', undefined);
            this.enterStandby('No flags for me');
          }
          break;

        case 'boosting':
          if (target) this.moveTo(Game.getObjectById(target));
          break;

        case 'unboost':
          // travel to a secondary lab and get unboosted.
          if (target) {
            const lab = typeof target === 'string' ? Game.getObjectById(target) : target;
            if (lab && lab.cooldown === OK) {
              const status = lab.unboostCreep(this.creep);
              if (status === OK || status === ERR_NOT_FOUND) {
                // cool
              } else if (status === ERR_NOT_IN_RANGE) {
                this.moveTo(lab);
              }
            }
          }

          const nearbyResource = this.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 2).onFirst(f => f);
          if (nearbyResource) {
            const status = this.pickup(nearbyResource);
            if (status === OK) {
              this.setTask('unload');
              this.setTarget(this.getStorage());
              this.set('resource', nearbyResource.resourceType);
            }
          } else if (Object.keys(this.creep.store).length > 0) {
            this.setTask('unload');
            this.setTarget(this.getStorage());
            this.set('resource', Object.keys(this.creep.store)[0]);
          }
          break;

        case 'standby':
        default:
          // do nothing
          // todo: what can I do here about standby?
          break;
      }
    } catch (e) {
      // throw e;
      this.creep.say('‼️⁉️');
      console.log(this.creep.name, this.creep.room.name, 'failed task', e);
    }
  }
}

module.exports = BaseCreep;
