const BaseCreep = require('Creep.class');
const config = require('config');
const TaskController = require('TaskController');
const GameMap = require('GameMap');
const utils = require('utils');
const jobs = require('droneJobs');

const { JOBS, DRONE_LIMIT } = config;

// creates a hauler that turns itself into energy in the indicated room
// const bod = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
// global.Spawn2.createDrone('hauler', bod, { homeRoom: 'W2N53', task: 'load', target: '68227b7ac59be40788f9b9c6', taskQueue: [{ name: 'reclaim' }] });
// send an 800 carry hauler to room 4
// global.Spawn3.createDrone('hauler', [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE], { homeRoom: 'W2N53', task: 'load', target: '68227b7ac59be40788f9b9c6', taskQueue: [{ name: 'unload', target: '6843957acf7e2aeecabe16e1' }] });
// 
// global.Spawn3.createDrone('upgrader', [WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE,CARRY,MOVE,CARRY,MOVE,CARRY, MOVE], {homeRoom: 'W2N53', task: 'load', target: '6843957acf7e2aeecabe16e1' });
// global.Spawn4.createDrone('upgrader', [WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE,CARRY,MOVE,CARRY,MOVE,CARRY, MOVE], {task: 'load', target: '6845fa00d7c5d44e58b4fa78' });
// 
// global.Spawn3.createDrone('hauler', [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE], { mode: 'transfer', targetStore: '6845fa00d7c5d44e58b4fa78' });
// global.Spawn3.createDrone('builder', [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE,CARRY,MOVE,CARRY,MOVE,CARRY, MOVE, MOVE,WORK, WORK, WORK, WORK, WORK, MOVE, MOVE,CARRY,MOVE,CARRY,MOVE,CARRY, MOVE, MOVE], {targetRoom:'W2N53',homeRoom:'W2N53',task:'load',target:'6845fa00d7c5d44e58b4fa78'});
//
// global.Drone.getDrone('drone-69938280-chan').setTaskQueue()
// global.Drone.getDrone('drone-69694007-chan').setTaskQueue()
// to Terminal
// [{ name: 'unload', target: '68227b7ac59be40788f9b9c6' }, { name: 'load', target: '68227b7ac59be40788f9b9c6', resource: 'H' }, { name: 'unload', target: '682f84102cf69ad2bed243b2', resource: 'H' }]
// from Terminal
// [{ name: 'unload', target: '68227b7ac59be40788f9b9c6' }, { name: 'load', target: '682f84102cf69ad2bed243b2', resource: 'ZH' }, { name: 'unload', target: '68227b7ac59be40788f9b9c6', resource: 'ZH' }]
// [{ name: 'unload', target: '68227b7ac59be40788f9b9c6' }, { name: 'load', target: '682f84102cf69ad2bed243b2', resource: 'ZH' }, { name: 'unload', target: '682a97e8f57bb72a7bda8936', resource: 'ZH' }]
// 
// [{ name: 'unload', target: '68227b7ac59be40788f9b9c6' }, { name: 'load', target: '682f84102cf69ad2bed243b2', resource: 'GO' }, { name: 'unload', target: '68227b7ac59be40788f9b9c6', resource: 'GO' }]
// 
// [{ name: 'unload', target: '68227b7ac59be40788f9b9c6' }, { name: 'load', target: '68227b7ac59be40788f9b9c6', resource: 'GO' }, { name: 'unload', target: '681ad029b09ecaa808dc04e1', resource: 'GO' }, { name: 'unload', target: '68227b7ac59be40788f9b9c6' }]

// global.Spawn9.createDrone('interupter', [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK], {targetRoom:'E4N52'})
// global.Spawn9.createDrone('sweeper', [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY], {targetRoom:'E4N52'})
// 
// 6830f65310e84dd6a6c7ccae
// global.Drone.getDrone('hauler-69679250-chan').setTaskQueue()
// 
// Assist mineral deposit - { homeRoom: 'W7N52', targetRoom: 'W3N50', source: '6847389d8863b9ed4022c9ae' }
// global.Spawn1.createDrone('hauler', [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE], { homeRoom: 'W7N52', targetRoom: 'W3N50', source: '6847389d8863b9ed4022c9ae' });
// 
// global.Spawn5.createDrone('drone', [WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,WORK,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE], {targetRoom:'E14N49',homeRoom:'E14N49'});
// 
// global.Spawn5.createDrone('drone', [MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,WORK,CARRY,MOVE,MOVE], {homeRoom:'W9N55',targetRoom:'W9N55',task:'harvest',source:'5bbcac5c9099fc012e63553d'})
// 
// global.Spawn4.createDrone('hauler', [MOVE,CARRY,MOVE,CARRY], {mode:'transfer',plan:{resource:'X',fromStore:'6845fa00d7c5d44e58b4fa78',targetStore:'683af8b69216373942085dc7'}})
// 
// 
// global.Spawn1.createDrone('', [], { targetRoom: '' })

/**
 * Drones perform `tasks` based on the assigned `job`
 * Drones keep themselves alive by going to the spawner for repairs at 350 ticksToLive
 */
class Drone extends BaseCreep {
  get hive() {
    return global.hives[this.memory.homeRoom];
  }

  static getDrone(creepName) {
    const creep = Game.creeps[creepName];
    return new Drone(creep);
  }

  static runDrones() {
    if (!global.drones) global.drones = {};

    // when I loop game creeps, I want to 
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (creep.memory.role !== 'drone') {
        if (!creep.memory.role) {
          const mem = Drone.findMemory(creep.name);
          if (mem) creep.memory = mem;
        }
        continue;
      }
      let hasTaskCount = 0;

      if (global.drones[name]) {
        const drone = global.drones[name];
        drone.run();
      } else if (creep) {
        const drone = new Drone(creep);
        global.drones[name] = drone;

        // distributes creeps to each room
        const hr = creep.memory.homeRoom;
        const key = `${hr}-creeps`;
        if (!global[key]) global[key] = {};
        global[key][name] = creep;
      }
    }
  }

  static findMemory(name) {
    let myMem;
    for (const shard of ALL_SHARDS) {
      const intershardMem = InterShardMemory.getRemote(shard);
      if (intershardMem) {
        const mem = JSON.parse(intershardMem);
        if (mem && mem[name]) {
          myMem = mem[name];
          myMem._pos = undefined;
          myMem.task = 'standby';
        }
      }
    }
    return myMem;
  }

  constructor(creep, job = null) {
    if (!creep) {
      throw new Error('Must supply a creep');
    } else if (typeof creep === 'string') {
      creep = Game.creeps[creepName];
    }

  	super(creep);
  }

  toString() {
    return `<b>${this.name}</b> - Task: ${this.get('task')} : Queue ${this.get('taskQueue')}`;
  }

  getSourceStores () {
    const sourceId = this.get('source');
    const sourceMem = sourceId && this.creep.room.memory.sources[sourceId];

    if (sourceMem) {
      const link = sourceMem.link && Game.getObjectById(sourceMem.link);
      const container = sourceMem.container && Game.getObjectById(sourceMem.container);
      return { link, container };
    }
    return {};
  }

  findSourceDrops () {
    let droppedResources = [];
    for (const id in this.room.memory.sources) {
      const mem = this.room.memory.sources[id];
      const container = mem.container && Game.getObjectById(mem.container);
      if (!container || container.store.getFreeCapacity() <= 100) {
        const source = Game.getObjectById(id);
        const drops = source.pos.findInRange(FIND_DROPPED_RESOURCES, 2, {
          filter: (resource) => resource.amount >= 50,
        });
        if (drops.length > 0) {
          droppedResources = [...droppedResources, ...drops];
        }
      }
    }
    return droppedResources;
  }

  findClosestDroppedResource() {
    const room = this.creep.room;
    if (room.memory.encounter) {
      const droppedResources = this.findSourceDrops();
      if (droppedResources.length > 0) {
        return this.creep.pos.findClosestByPath(droppedResources);
      }
      return null;
    } else {
      return this.creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: r => r.amount >= 50,
      });
    }
  }

  getEnergizedContainer(amount = null) {
    const spawn = this.getSpawn();
    const room = spawn && spawn.room;
    const source = this.getSource();
    const sourceMem = source && source.id && room && room.memory.sources && room.memory.sources[source.id];

    if (sourceMem && sourceMem.container) {
      return Game.getObjectById(sourceMem.container);
    } else if (room && room.memory.sources) {
      const containers = [];

      for (const source in room.memory.sources) {
        const mem = room.memory.sources[source];
        const container = mem.container ? Game.getObjectById(mem.container) : null;
        if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > amount ? amount : 0) {
          containers.push(container);
        }
      }

      if (containers.length > 1) {
        return this.creep.pos.findClosestByPath(containers);
      } else if (containers.length === 1) {
        return containers[0];
      } else {
        return null;
      }
    }
  }

  getHarvestTask() {
    const harvestTask = { name: 'harvest', target: null };
    const dropOffTask = { name: 'unload', target: null, resource: null };

    const mineral = this.creep.pos.findClosestByPath(FIND_MINERALS);
    if (mineral) {
      harvestTask.target = mineral.id;
      dropOffTask.resource = mineral.resourceType;
    }

    const storage = this.getStorage();
    if (storage) dropOffTask.target = storage.id;

    return harvestTask.target && dropOffTask.target ? [harvestTask, dropOffTask] : null;
  }

  getTransferTask() {
    const pickupTask = { name: 'load', target: null, resource: null };
    const dropOffTask = { name: 'unload', target: null, resource: null };
    return pickupTask.target && dropOffTask.target ? [pickupTask, dropOffTask] : null;
  }

  getLowEnergyTower() {
    const mem = this.room.memory;
    if (mem.tEnergy) {
      for (const lowEnergyTower in mem.tEnergy) {
        if (lowEnergyTower) {
          return lowEnergyTower.id;
          // this.setTask('unload', lowEnergyTower.id);
        }
      }
    }
  }

  findNewBankOrReclaim() {
    const powerBanks = Memory.powerBanks;
    if (powerBanks) {
      let nearestBank;
      let distance = Infinity;
      for (const pb in powerBanks) {
        // could I just try and steal a bank?
        if (powerBanks[pb].hostiles === 0) {
          const route = GameMap.findRoute(this.creep.room.name, powerBanks[pb].room)
          if (route.length !== 0 && route.length <= distance && route.length <= 8) {
            distance = route.length;
            nearestBank = pb;
          } 
        }
      }

      if (nearestBank) {
        this.set('targetRoom', powerBanks[nearestBank].room);
        this.set('powerBank', nearestBank);
        this.setTask('moveToRoom');
        return;
      }
    }
    this.setTask('reclaim');
  }

  /**
   * All tasks should run until they shift the bot into standby or another task
   */
  run() {
    try {
      // const prevCpu = this.get('totalCpu');
      // let cpu = Game.cpu.getUsed();
      this.eolSequence();

      const bucketCheck = Game.cpu.bucket > 5000;

      if (!this.isStandby()) {
        this.runTask();
      } else if (this.hasTaskQueued()) {
        this.processQueue();
      } else if ((this.get('nextJobCheck') || 0) <= Game.time && bucketCheck) {
        const targetShard = this.get('targetShard');
        if (targetShard && targetShard !== Game.shard.name) {
          return this.travelToShard(this.get('targetShard'));
        }

        // let cpu = Game.cpu.getUsed();
        const jobFunc = jobs[this.get('job')];
        if (jobFunc) jobFunc(this);
        // cpu = Game.cpu.getUsed() - cpu;
        // if (cpu >= 0.1 && Game.shard.name === 'shard3') console.log(this.creep.room.name, this.creep.name, 'cpu', cpu.toFixed(4));
      }

      // stat tracking!
      // const totalCpu = prevCpu + (Game.cpu.getUsed() - cpu);
      // this.set('totalCpu', totalCpu);
      // this.set('avgCpu', totalCpu / this.creep.ticksToLive);
    } catch (e) {
      console.log(this.creep.room.name, this.name,':', e);
      // throw e;
    }
  }
}

module.exports = Drone;
