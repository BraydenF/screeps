const config = require('config');
const GameMap = require('GameMap');
const LabController = require('LabController');
const productionNotifier = require('productionNotifier');

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

  get memory() {
    return this.creep.memory;
  }

  // set memory(mem) {
  //   Memory.creeps[this.creep.name] = { ...this.creep.memory, ...mem };
  // }

  get creep() {
    return Game.creeps[this.name];
  }

  get pos() {
    return this.creep.pos;
  }

  get taskQueue() {
    return this.get('taskQueue') || [];
  }

  get task() {
    return this.get('task');
  }

  set task(task) {
    if (this.memory.task !== task) this.set('task', task);
  }

  get resource() {
    return this.get('resource');
  }

  set resource(resource) {
    // this.resource = resource;
    if (this.memory.resource !== resource) this.set('resource', resource);
  }

  get target() {
    return this.get('target');
  }

  set target(target) {
    // this.target = target;
    if (this.memory.target !== target) this.set('target', target);
  }

  get amount() {
    return this.get('amount');
  }

  set amount(amount) {
    if (this.creep.memory.amount !== amount) this.creep.memory.amount = amount;
  }

  get interuptable() {
    return ['healer'].includes(this.creep.memory.job);
  }

  get hitPercentage() {
    return this.creep.hits / this.creep.hitsMax;
  }

	constructor(creep) {
    const memory = creep.memory || {};
    this.name = creep.name;
		// this.creep = creep;
  }

  get(key) {
    return this.creep.memory[key];
  }

  set(key, value) {
    this.creep.memory[key] = value;
  }

  hasTask(task) {
    return this.memory.task === task;
  }

  setTask(task = 'standby', target = null, message = null) {
    if (typeof task === 'object') {
      if (task.resource) this.set('resource', task.resource);
      if (task.amount) this.set('amount', task.amount);
      if (task.target) target = task.target;
      task = task.name || task.task || 'standby';
    }

    this.set('task', task);
    if (target) this.setTarget(target);
    if (message && Game.cpu.bucket >= 10000) this.creep.say(message);
  }

  setTaskQueue(tasks, message) {
    this.set('taskQueue', tasks);
    if (message && Game.cpu.bucket >= 10000) this.creep.say(message);
  }

  pushTask(task) {
    this.taskQueue.push(task);
  }

  hasTaskQueued() {
    return this.taskQueue.length > 0;
  }

  isStandby() {
    return !this.memory.task || this.hasTask('standby');
  }

  enterStandby() {
    this.creep.memory = {
      ...this.creep.memory,
      task: 'standby',
      target: null,
      resource: undefined,
      amount: undefined,
      _move: undefined,
    };
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

  getHomeRoom() {
    return Game.rooms[this.get('homeRoom')];
  }

  hasResources() {
    for (const resourceType in this.creep.store) {
      if (this.creep.store[resourceType] > 0) {
        return resourceType; 
      }
    }
    return null;
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
    for (const resource in this.creep.store) {
      return resource;
    }
  }

  getHarvestPower(resource = 'energy') {
    let harvestPower = this.get('harvest-power');

    if (!harvestPower) {
      const basePower = resource === 'energy' ? HARVEST_POWER : HARVEST_MINERAL_POWER;
      harvestPower = this.creep.body.reduce((acc, part) => {
        if (part.type === WORK) {
          if (part.boost && BOOSTS[WORK][part.boost]) {
            acc = acc + BOOSTS[WORK][part.boost].harvest;
          } else {
            acc = acc + basePower;
          }
        }
        return acc;
      }, 0);
      this.set('harvest-power', harvestPower);
    }

    return harvestPower;
  }

  storeTravelerMemory() {
    const data = InterShardMemory.getLocal();
    let travelers = data ? JSON.parse(data) : {};
    travelers[this.creep.name] = { ...this.creep.memory, homeShard: Game.shard.name };
    InterShardMemory.setLocal(JSON.stringify(travelers));
  };

  usePortal(portal) {
    // if (!this.get('homeShard')) this.set('homeShard', Game.shard.name);
    this.storeTravelerMemory();
    this.setTask('moveTo');
    this.setTarget(portal);
  }

  moveTo(target, options = {}) {
    if (this.creep.fatigue > 0) return ERR_TIRED;

    let targetPos;
    if (target instanceof RoomPosition) {
      targetPos = target;
    } else if (typeof target === 'string') {
      const obj = Game.getObjectById(target);
      targetPos = obj ? obj.pos : null;
    } else if (target && target.pos) {
      targetPos = target.pos;
    } else if (target && target.roomName && target.x && target.y) {
      targetPos = new RoomPosition(target.x, target.y, target.roomName);
    }

    if (!targetPos) {
      this.set('target', null);
      return ERR_INVALID_TARGET;
    }

    if (this.creep.room.name === targetPos.roomName) {
      return this.creep.moveTo(targetPos, { ...config.moveToOpts, ...options });
    } else {
      const route = GameMap.findRoute(this.creep.room.name, targetPos.roomName);
      if (!route || route === ERR_NO_PATH || route.length === 0) {
        return ERR_NO_PATH;
      }

      const mem = this.creep.memory;
      let moveTo = Game.getObjectById(mem.target || mem.source || mem.powerBank);

      if (!moveTo) {
        const nextExitDir = route[0].exit;
        moveTo = this.creep.pos.findClosestByPath(nextExitDir);
        if (!moveTo) return ERR_NO_PATH; 
      }

      return this.creep.moveTo(moveTo, {
        ...config.moveToOpts,
        maxRooms: route.length + 1,
        reusePath: 50,
      });
    }
    return ERR_NO_PATH;
  }

  moveToRoom(roomName) {
    if (this.creep.fatigue > 0) return ERR_TIRED;
    const currentRoom = this.creep.room.name;
    const route = GameMap.findRoute(currentRoom, roomName);
    if (route.length > 0) {
      // const mem = this.creep.memory;
      // const moveTo = Game.getObjectById(mem.target || mem.source || mem.powerBank);
      // if (route.length === 1 && moveTo) {
      //   this.creep.moveTo(moveTo, config.moveToOpts);
      // } else {
        let exitPos = this.get('_exitPos');
        if (exitPos && exitPos.roomName === currentRoom) {
          exitPos = new RoomPosition(exitPos.x, exitPos.y, exitPos.roomName);
        } else {
          exitPos = this.creep.pos.findClosestByPath(route[0].exit);
          if (exitPos) this.set('_exitPos', exitPos);
        }

        if (exitPos) {
          return this.creep.moveTo(exitPos, { ...config.moveToOpts, reusePath: 50 });
        }
      // }
    }
    return ERR_NO_PATH;
  }

  travelToShard(targetShard, targetRoom) {
    // moves along a predetermined path to the desired room in the desired shard
    const path = {
      shard3: { targetRoom: 'E10N50', portal: '5c0e406c504e0a34e3d61dc0' }, // include pos in the future?
      shard2: { targetRoom: 'E10N50', portal: '59f1c0062b28ff65f7f213f9' },
      shard1: { targetRoom: 'W3N51', portal: '' },
    };

    if (Game.shard.name !== targetShard) {
      if (path && path[Game.shard.name]) {
        if (this.room.name === path[Game.shard.name].targetRoom) {
          this.usePortal(path[Game.shard.name].portal);  
        } else {
          this.setTask('moveToRoom');
          this.set('_pos', { x: 25, y: 25, roomName: path[Game.shard.name].targetRoom });
        }
      }
    } else {
      this.enterStandby();
    }
  }

  moveAway(target) {
    const dx = this.creep.pos.x - target.pos.x;
    const dy = this.creep.pos.y - target.pos.y;
    const nx = Math.max(1, Math.min(48, this.creep.pos.x + dx));
    const ny = Math.max(1, Math.min(48, this.creep.pos.y + dy));
    return this.creep.moveTo(nx, ny);
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

    return status;
  }

  rangedAttack(target, maxDistance = 2, minDistance = 2) {
    if (typeof target === 'string') target = Game.getObjectById(target);
    if (!target) {
      this.enterStandby();
    }

    const range = this.creep.pos.getRangeTo(target);
    if (range > maxDistance) {
      this.moveTo(target);
      if (range > 3) return ERR_NOT_IN_RANGE; // max range is 3
    }

    const status = this.creep.rangedAttack(target);
    if (status == ERR_NOT_IN_RANGE) {
      this.moveTo(target);
    } else if (range < minDistance) {
      this.moveAway(target);
    }

    return status;
  }

  attackController() {
    const controller = this.creep.room.controller;
    if (this.creep.pos.isNearTo(controller)) {
      const status = this.creep.attackController(controller);
      if (status === OK) {
        this.creep.suicide();
        // let travelTime = this.get('travelTime');
        // if (travelTime && this.creep.ticksToLive >= travelTime) {
        //   this.setTask('reclaim');
        // }
      } else if (status === ERR_INVALID_TARGET) this.enterStandby();
    } else {
      this.moveTo(controller);
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

  transfer(target, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target && this.creep.pos.isNearTo(target)) {
      const status = this.creep.transfer(target, resource, amount);
      // if (status == ERR_NOT_IN_RANGE) {
      //   this.moveTo(target);
      // }
      return status;
    } else {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }
  }

  dropAll() {
    // drop all resources
    for (const resourceType in this.creep.carry) {
      this.creep.drop(resourceType);
    }
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
      if (status === ERR_INVALID_TARGET || status === ERR_NOT_ENOUGH_RESOURCES) {
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
    } else if (status === OK && target.hitsMax === target.hits) {
      this.enterStandby();
    }

    return status;
  }

  upgrade() {
    const controller = this.creep.room.controller;

    if (this.creep.pos.inRangeTo(controller, 3)) {
      const status = this.creep.upgradeController(controller);

      if (status === ERR_NOT_IN_RANGE) {
        this.moveTo(controller);
      } else if (status === ERR_NOT_ENOUGH_RESOURCES || status === ERR_NOT_OWNER) {
        this.enterStandby();
      }

      return status;
    } else {
      this.moveTo(controller);
      return ERR_NOT_IN_RANGE;
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
    return Game.getObjectById(sources.rand());
  }

  canHarvest(resource = 'energy') {
    const harvestPower = this.getHarvestPower(resource);
    const carryCount = this.creep.getActiveBodyparts(CARRY);
    const freeCapacity = this.creep.store.getFreeCapacity(resource);

    const creepWillOverflow = freeCapacity === 0 || harvestPower > freeCapacity;
    const canHarvest = (!carryCount && !this.isEnergyFull()) || (carryCount && !creepWillOverflow);

    return canHarvest;
  }

  harvest(target) {
    if (typeof target === 'string') target = Game.getObjectById(target);
    // console.log('harvest', target, this.creep.pos.isNearTo(target));
    if (!this.creep.pos.isNearTo(target)) {
      this.creep.moveTo(target);
      return ERR_NOT_IN_RANGE;
    } else if (target.cooldown && target.cooldown > 4) {
      const resourceType = target.mineralType || target.depositType;
      if (this.creep.store.getUsedCapacity(resourceType) > 0) {
        const haulers = this.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: { memory: { job: 'hauler' } } })
          .sort((a, b) => {
            return a.store.getFreeCapacity('energy') - b.store.getFreeCapacity('energy');
          });

        if (haulers.length > 0 && haulers[0].store.getFreeCapacity(resourceType) !== 0) {
          this.setTask('unload', haulers[0].id);
          this.set('resource', resourceType);
        }
      }
      return ERR_TIRED;
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
        const resourceType = target.mineralType || target.depositType;
        if (resourceType) {
          productionNotifier.incrementCounter(resourceType, this.creep.getActiveBodyparts(WORK));
        }
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

  dismantle(target) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
        this.enterStandby();
    } else if (!this.creep.pos.isNearTo(target)) {
      this.creep.moveTo(target);
      return ERR_NOT_IN_RANGE;
    } else {
      const status = this.creep.dismantle(target);
      if (status === ERR_INVALID_TARGET) {
        this.enterStandby();
      }
      return status;
    }
  }

  load(target = null, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);
    if (!target) return ERR_INVALID_TARGET;

    if (!this.creep.pos.isNearTo(target)) {
      this.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const status = this.creep.withdraw(target, resource, amount);
    // if (this.creep.name === 'hauler-77952785-chan') console.log('load', target, resource, status);

    if (status === OK || status === status || status === ERR_INVALID_TARGET || status === ERR_FULL) {
      this.enterStandby();
    }

    return status;
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
    } else if (target) {
      if (!this.creep.pos.isNearTo(target)) {
        if (this.creep.room.name !== target.pos.roomName) {
          this.moveToRoom(target.pos.roomName);
        } else {
          this.moveTo(target);
        }
        return ERR_NOT_IN_RANGE;
      }
    }

    const status = this.transfer(target, resource, amount);
    // if (this.creep.name === 'hauler-77952785-chan') console.log('unload', target, resource, status)
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
    if (status === ERR_INVALID_TARGET) {
      this.enterStandby();
    }
    return status;
  }

  // pass an array of creeps to check their HP instead!
  triage(creeps = []) {
    let woundedCreeps = [];

    if (creeps.length > 0) {
      woundedCreeps = creeps.sort((a, b) => a.hits > b.hits);
    } else {
      woundedCreeps = this.creep.pos.findInRange(FIND_MY_CREEPS, 7, { filter: creep => creep.hits < creep.hitsMax })
        .sort((a, b) => a.hits > b.hits);
    }

    let status;
    if (woundedCreeps.length > 0) {
      const range = this.creep.pos.getRangeTo(woundedCreeps[0]);
      if (range === 1) {
        status = this.creep.heal(woundedCreeps[0]);

        // this reduces damage when there is a single healer working on multiple units for powerbanks
        // if (status === OK && !this.get('target')) {
        //   this.setTarget(woundedCreeps[0]);
        // }
      } else if (range <= 5) {
        status = this.creep.rangedHeal(woundedCreeps[0]);
        if (range >= 2) {
          this.moveTo(woundedCreeps[0]);
        }
      } else {
        this.moveTo(woundedCreeps[0]);
      }
    } else {
      this.enterStandby();
      this.set('nextJobCheck', Game.time + 5);
    }
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
    const mem = this.creep.memory;

    // update to check only creeps flagged as boosted. 
    if (mem.boosted || mem.job === 'upgrader') {
      const nearDeath = this.creep.ticksToLive <= 100;
      if (nearDeath && !this.hasTask('unboost') && !this.hasTask('recharge')) {
        const isBoosted = this.creep.body.reduce((acc, part) => part.type === WORK && part.boost ? true : acc, false);

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
  }

  clearMemory() {
    this.creep.memory = {};
  }

  processQueue() {
    const taskQueue = this.taskQueue;
    if (!taskQueue.isEmpty) {
      const qtask = taskQueue.shift();
      this.setTaskQueue(taskQueue);

      if (typeof qtask === 'object') {
        const task = qtask.name || qtask.task;
        if (task) {
          this.setTask(task);
          if (qtask.target) this.setTarget(qtask.target);
          if (qtask.resource) this.set('resource', qtask.resource);
          if (qtask.amount) this.set('amount', qtask.amount);
        }
      } else {
        this.setTask(qtask);
      }
    }
  }

  runTask() {
    try {
      const source = Game.getObjectById(this.get('source'));
      const bank = Game.getObjectById(this.get('powerBank'));
      let task = this.task;
      let target = this.target;
      let resource = this.resource;
      let amount = this.amount;
      let status;

      // basic task operation
      switch (task) {
        case 'targetRoom':
        case 'moveToRoom':
          // this.set('task', 'moveToRoom')
          const pos = this.get('_pos');
          const targetRoom = pos ? pos.roomName : this.get('targetRoom');
          if (this.creep.room.name === targetRoom) {
            // find nearest exit && this.creep.move(AWAY_FROM_EXIT)
            if (this.room.controller) this.creep.moveTo(this.room.controller);
            else this.creep.moveTo(new RoomPosition(25, 25, targetRoom))
            this.enterStandby();
          } else {
            let status = this.moveToRoom(targetRoom || this.get('homeRoom'));
          }
          break;

        case 'moveTo':
          // console.log('MOVETO target', target)
          status = this.moveTo(target);
          if (this.creep.pos.getRangeTo(target) === 0) this.enterStandby();
          break;

        case 'pickup':
          const energyNearSource = source && source.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

          if (energyNearSource && energyNearSource.pos.isNearTo(source)) {
            status = this.pickup(energyNearSource);
          } else {
            const targetedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: { id: target }});
            status = this.pickup(targetedResources);
          }
          break;

        case 'load':
          if (!target) {
            const salvage = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
              filter: tombstone => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
            });
            if (salvage) {
              target = salvage.id;
              status = this.setTarget(target);
            }
          }

          this.load(target, resource, amount);
          break;

        case 'unload':
          // nothing to unload or target the is full
          if (!global.hasKeys(this.creep.store)) this.enterStandby();
          else if (target && target.store && target.store.getFreeCapacity() === 0) this.enterStandby();

          // non energy resources default to storage.
          if (resource && resource !== 'energy' && !target) {
            target = this.getStorage();
          } else if (!target) {
            // if I am not home, I need to go home
            // how can I best prevent this search with out adding it to too many ticks

            // const spawns = global.rooms[this.room.name] && global.rooms[this.room.name].spawns;
            // what if I just assume I need to put energy in the primary?
            // const extensions = global.rooms[this.room.name] && global.rooms[this.room.name].extensions;
            if (!target && this.creep.room.energyCapacityAvailable - this.creep.room.energyAvailable > 0) {
              target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
                  || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
              });
            }

            if (!target && this.creep.room.memory.tEnergy) {
              for (const lowEnergyTower in this.creep.room.memory.tEnergy) {
                target = lowEnergyTower;
                break; // Exit immediately after finding the first key
              }
            }

            const spawn = this.getSpawn();
            const spawnRoom = spawn && spawn.room;
            const upgradeContainer = spawnRoom && spawnRoom.memory.upgradeContainer && Game.getObjectById(spawnRoom.memory.upgradeContainer);
            if (!target && upgradeContainer && upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) <= 1800) {
              target = upgradeContainer;
            }

            if (!target && this.creep.room.memory.labEnergy) {
              for (const lowEnergyLab in this.creep.room.memory.labEnergy) {
                target = lowEnergyLab;
                break; // Exit immediately after finding the first key
              }
            }

            const terminal = this.creep.room.terminal;
            if (!target && terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
              target = terminal;
            }

            const factory = global.rooms[this.room.name] && global.rooms[this.room.name].factory;
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
                  const assistingUpgrade = !upgradeContainer && creep.memory.task === 'upgrade';
                  const assistingDrone = creep.memory.job === 'drone' && creep.memory.task === 'build';
                  return assistingRecharge || assistingUpgrade || assistingDrone;
                },
              });
            }

            if (!target && this.room.memory.powerSpawn) {
              const powerSpawn = Game.getObjectById(this.room.memory.powerSpawn);
              if (powerSpawn && powerSpawn.store.getFreeCapacity('energy') >= 1000) {
                target = powerSpawn;
              }
            }

            if (!target && terminal && terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 10000) {
              target = terminal;
            }
          }

          if (target && !this.getTarget()) this.setTarget(target);
          status = this.unload(target, resource, amount);
          break;

        case 'drop': 
          if (resource) {
            status = this.creep.drop(resource);
          } else {
            status = this.dropAll();
          }
          this.enterStandby();
          break;

        case 'harvest':
          if (this.get('safeHarvest') && this.creep.hits !== this.creep.hitsMax) {
            // flee nearest enemy
          }
          // can I pass the resource??
          if (this.canHarvest(source && source.mineralType)) {
            target = target || this.get('source');
            if (!target) {
              target = this.getRandomSource();
              this.setTarget(target.id);
            } else if (typeof target === 'string') {
              target = Game.getObjectById(target);
            };

            status = this.harvest(target);
          } else {
            status = this.enterStandby();
          }
          break;

        case 'build':
          status = this.build(target);
          break;

        case 'upgrade':
          status = this.upgrade();
          break;

        case 'repair':
          if (!target) {
            let repairTarget = this.room.find(FIND_STRUCTURES, { filter: (struct) => {
              const minimumDamage = (struct.hitsMax - struct.hits) >= 1000;
              if (!minimumDamage) return false;
              switch(struct.structureType) {
                case STRUCTURE_CONTAINER:
                  return struct.hits < 175000;
                case STRUCTURE_ROAD:
                  return struct.hits > 5000 && struct.hits < 550000;
                case STRUCTURE_WALL:
                case STRUCTURE_RAMPART:
                  return struct.hits <= 12000000;
              }
            }}).sort((a, b) => a.hits - b.hits).first();

            if (repairTarget) {
              target = repairTarget;
              this.set('target', repairTarget.id);
            } else {
              // this.creep.say('OH YAEH');
            }
          }

          status = this.repair(target);
          break;

        case 'transfer':
          status = this.transfer(this.get('targetStore'));
          break;

        case 'energyTransfer':
          status = this.energyTransfer();
          break;

        case 'dismantle':
          status = this.dismantle(target);
          // console.log('dismantle', status)
          break;

        case 'recharge':
          status = this.recharge();
          break;

        case 'reclaim':
          const spawn = this.getSpawn();
          if (!this.creep.pos.isNearTo(spawn)) status = this.moveTo(spawn);
          else status = spawn.recycleCreep(this.creep);
          break;

        case'power-attack':
          if (this.creep.hits < 1000) break;
        case 'attack':
          let tar = this.get('target');
          if (!this.creep.pos.isNearTo(tar)) this.moveTo(tar);
          status = this.attack(tar);
          break;

        case 'siege':
          const siegeTarget = this.get('targetRoom');
          if (this.creep.room.name === siegeTarget) {
            status = this.siege();
          } else {
            status = this.moveTo(siegeTarget);
          }
          break;

        case'power-range-attack':
          if (bank && this.creep.pos.getRangeTo(bank) === 1) {
            this.moveToRoom(this.get('homeRoom'));
          }
          if (this.creep.hits / this.creep.hitsMax <= 0.9) {
            const status = this.creep.heal(this.creep);
            if (status === OK) break;
          } else {
            // const status = this.triage();
            // if (status === OK) break;
          }
        case 'range-attack':
          status = this.rangedAttack(this.get('target'));
          break;

        case 'triage':
          // what if every few ticks, I remember which creeps I am trying to triage.
          if (this.creep.hits / this.creep.hitsMax <= 0.9) {
            this.creep.heal(this.creep);
          } else {
            let squad = global.squads[this.get('powerBank')];
            this.triage(squad);
          }
          break;

        case 'power-heal':
          if (bank) {
            const rangeToBank = this.creep.pos.getRangeTo(bank);
            if (rangeToBank === 1) this.moveAway(bank);
            else if (rangeToBank >= 5) this.moveTo(bank);
          }

          if (this.creep.hits / this.creep.hitsMax <= 0.9) {
            this.creep.heal(this.creep);
            break;
          } else if (!this.get('target')) {
            let squad = global.squads[this.get('powerBank')];
            if (squad && squad.length > 0) {
              const status = this.triage(squad);
              break;
            }
          }

        case 'heal':
          if (!target) {
            const woundedCreeps = this.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: creep => creep.hits < creep.hitsMax })
              .sort((a, b) => a.hits > b.hits);
            target = this.creep.pos.findClosestByRange(FIND_MY_CREEPS, { filter: creep => creep.hits < creep.hitsMax });
          } else if (typeof target === 'string') target = Game.getObjectById(target);

          if (target) {
            if (target.hits === target.hitsMax) {
              this.enterStandby();
            } else if (this.creep.pos.isNearTo(target)) {
              status = this.creep.heal(target);
            } else {
              status = this.creep.rangedHeal(target);
              this.moveTo(target);
            }
          } else {
            this.enterStandby();
          }
          break;

        case 'attackController':
          status = this.attackController();
          break;

        case 'reserve':
          status = this.reserve(this.get('targetRoom'));
          break;

        case 'claim':
          status = this.claim(this.get('targetRoom') || this.creep.room.name);
          break;

        case 'flag':
          const flag = this.getFlag();
          if (flag) {
            this.moveTo(flag);
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
              const labStatus = lab.unboostCreep(this.creep);
              if (labStatus === OK || labStatus === ERR_NOT_FOUND) {
                // cool
              } else if (labStatus === ERR_NOT_IN_RANGE) {
                this.moveTo(lab);
              }
            }
          }

          const nearbyResource = this.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 2).onFirst(f => f);
          if (nearbyResource) {
            status = this.pickup(nearbyResource);
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

        case 'sign':
          ['Beware the Square', 'Four is More'];
          const message = this.get('message');
          if (message) {
            const controller = this.room.controller;
            if (this.creep.pos.isNearTo(controller)) {
              const status = this.creep.signController(this.room.controller, message);
              if (status === OK) this.enterStandby();
            } else {
              this.creep.moveTo(controller);
            }
          }
          break;
      }

      // console.log(this.creep.name, this.memory.task, status);
    } catch (e) {
      throw e;
      this.creep.say('‼️⁉️');
      console.log(this.creep.name, this.creep.room.name, 'failed task', e);
    }
  }
}

module.exports = BaseCreep;
