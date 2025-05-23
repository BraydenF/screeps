const BaseCreep = require('Creep.class');
const config = require('config');

const { INITIAL_SPAWN, JOBS, DRONE_LIMIT, MODES } = config;

// global.Drone.getDrone('drone-69694346-chan').setTaskQueue()
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

class TaskController {
  assignTask(creepName, tasks) {
    const creep = Game.creeps[creepName];
    if (creep) {
      const hasTaskQueued = creep.memory.taskQueue && creep.memory.taskQueue.length;
      if (!hasTaskQueued) {
        // creep.memory.taskQueue = ;
      }
    }
  }

  constructor(spawn) {
    const mem = spawn.memory['TaskController'] || {};

    this.spawn = spawn;
    this.tasks = new global.Queue(mem.tasks || []);
  }

  get(key) {
    return this.spawn.memory['TaskController'][key];
  }

  set(key, value) {
    this.spawn.memory['TaskController'][key] = value;
  }

  getTask() {
    return this.tasks.dequeue();
  }

  peekTasks() {
    return this.tasks.peek();
  }

  findNearestEnergy(drone) {
    // the Drone is passed to assist in finding the closest appropriate energy source for his work
  }

  createLoadTask(targetId) {
    return { action: 'load', target: targetId, amount: target.store.getFreeCapacity() };
  }

  generateTasks() {
    let newTasks = [];

    // todo: for CPU purposes, loop over structures once to find all low power structures, figure out how to return them in a particular order?
    const criticalTowers = this.spawn.room.find(FIND_MY_STRUCTURES, {
      filter: struct => struct.structureType === STRUCTURE_TOWER && struct.store.getUsedCapacity(RESOURCE_ENERGY) < 400,
    }).forEach(tower => {
      newTasks.push(this.createLoadTask(tower.id));
    });

    const buildTargets = this.spawn.room.find(FIND_CONSTRUCTION_SITES).forEach(site => {
      let task = { action: 'build', target: site.id };
      newTasks.push(this.createLoadTask(site.id));
    });

    if (this.spawn.store.getFreeCapacity()) {
      newTasks.push(this.createLoadTask(spawn.id));
    }

    const extensions = this.spawn.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
    }).forEach(extension => {
      newTasks.push(this.createLoadTask(extension.id));
    });

    const upgradeContainer = spawn.memory.upgradeContainer && Game.getObjectById(spawn.memory.upgradeContainer);
    if (upgradeContainer) {
      newTasks.push(this.createLoadTask(upgradeContainer.id));
    }

    // todo: salvage tasks
    
    this.set('tasks', newTasks);
    console.log('newTasks', newTasks.length, newTasks);
  }
}

/**
 * Drones perform `tasks` based on the assigned `job`
 * Drones keep themselves alive by going to the spawner for repairs at 350 ticksToLive
 */
class Drone extends BaseCreep {
  static getDrone(creepName) {
    const creep = Game.creeps[creepName];
    return new Drone(creep);
  }

  static getDrones(job) {
    const drones = [];
    for(const name in Game.creeps) {
      const creep = Game.creeps[name];

      if (creep.memory.role === 'drone') {
        if (job) { // only displays drones of job
          if (creep.memory.job === job) {
              drones.push(new Drone(creep));
          }
        } else { // displays all drones
          drones.push(new Drone(creep));
        }
      }
    }

    return drones;
  }

  constructor(creep, job) {
    if (!creep) {
        throw new Error('Must supply a creep');
    }

  	super(creep);
    const memory = creep.memory || {};
    const sources = creep.room.find(FIND_SOURCES);

    // pulls old job, new job can be passed to contrucor
    this.set('job', memory.job ? memory.job : job);
    this.set('homeRoom', memory.homeRoom ? memory.homeRoom : this.creep.pos.findClosestByRange(FIND_MY_SPAWNS).name);
  }

  toString() {
    return `<b>${this.name}</b> - Task: ${this.get('task')} : Queue ${this.get('taskQueue')}`;
  }

  getSourceStores () {
    const sourceId = this.get('source');
    const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    const sourceMem = sourceId && spawn.memory.sources[sourceId];

    if (sourceMem) {
      const link = sourceMem.link && Game.getObjectById(sourceMem.link);
      const container = sourceMem.container && Game.getObjectById(sourceMem.container);
      return { link, container };
    }
    return {};
  }

  getHarvestTask() {
    const harvestTask = { name: 'harvest', target: null };
    const dropOffTask = { name: 'unload', target: null, resource: null };

    const mineral = this.creep.pos.findClosestByPath(FIND_MINERALS);
    console.log('mineral', mineral);
    if (mineral) {
      harvestTask.target = mineral.id;
      console.log('mineral.resourceType', mineral.resourceType);
      dropOffTask.resource = mineral.resourceType;
    }

    const storage = this.findStorage();
    if (storage) dropOffTask.target = storage.id;

    return harvestTask.target && dropOffTask.target ? [harvestTask, dropOffTask] : null;
  }

  getTransferTask() {
    const pickupTask = { name: 'load', target: null, resource: null };
    const dropOffTask = { name: 'unload', target: null, resource: null };
    return pickupTask.target && dropOffTask.target ? [pickupTask, dropOffTask] : null;
  }

  processJob() {
    this.job = this.get('job');
    const spawn = this.getSpawn();
    const LOG = false;
    const flag = this.getFlag();

    if (this.hasTask('queue')) {
      return; // ignore job logic when in queue mode.
    }
    switch(this.get('job')) {
      case 'mechanic':
      case 'drone':
        if (this.isStandby()) {
          // let task0 = { action: null };
          // if (this.get('mode') === 'test') {
          //   // a drone will be assigned two tasks 
          //   let task0;
          //   let task1;

          //   // testing logic for using the task queue instead of the traditional logic
            
          //   /** Identify a task */
          //   const towers = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
          //   const tower = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
          //     filter: struct => struct.structureType === STRUCTURE_TOWER && struct.store.getFreeCapacity(RESOURCE_ENERGY) > 200,
          //   });
          //   const repairTargets = this.creep.room.find(FIND_MY_STRUCTURES, {
          //     filter: object => (object.hits / object.hitsMax) <= 0.25 && object.hits <= 25000,
          //   });
          //   const buildTargets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
          //   const spawnOrExtension = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
          //     filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
          //       || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
          //   });
          //   const upgradeContainer = spawn.memory.upgradeContainer && Game.getObjectById(spawn.memory.upgradeContainer);

          //   // salvaging could be to get the energy for a task or to grab minerals
          //   const salvage = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
          //     filter: tombstone => tombstone.store.getUsedCapacity() >= 0,
          //   });

          //   /** Get energy for said task, if necessary */

          //   /** Identify a dropoff location as necessary */

          //   break; // test logic end
          // }


          const nonEnergy = this.isEnergyEmpty() && Object.keys(this.creep.store);
          if (nonEnergy && nonEnergy.length) {
            this.set('resource', nonEnergy[0]);
            this.setTask('unload');
            this.setTarget(this.findStorage());
          } else
          if (this.isEnergyEmpty()) {
            // todo: Update drones to use the task queue to allow for more complex task assignment.
            //    get energy => build, repair, chargeSpawn, chargeTower, chargeUpgrader, upgrade
            //        -- I wonder if ideally this is done with a task queue ran by the hive somehow --
            //    mine minerals
            //    harvest from nearby room
            const energizedStorage = this.findEnergizedStorage();
            const source = this.get('source') && Game.getObjectById(this.get('source'));
            const sourceMem = source && source.id && spawn.memory.sources[source.id];
            const container = sourceMem && sourceMem.container && Game.getObjectById(sourceMem.container);
            const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            const salvage = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
              filter: tombstone => tombstone.store.getUsedCapacity() >= 0,
            });

            if (salvage) {
              this.setTask('load');
              this.setTarget(salvage.id);
              this.set('resource', Object.keys(salvage.store)[0]);

              // salvage task should include picking up as many resources as possible, then energy.
              // todo: update to use a queue to grab multiple things.

              // this.pushTask({ name: 'load', target: salvage.id })
            } else if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > this.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
              this.setTask('load');
              this.setTarget(container.id);
              // this.pushTask({ name: 'load', target: container.id })
            } else if (energizedStorage) {
              this.setTask('load');
              this.setTarget(energizedStorage.id);
              // this.pushTask({ name: 'load', target: energizedStorage.id })
            } else if (droppedResources) {
              this.setTask('pickup');
            } else if (flag) {
              console.log('flag', flag, flag.task);
              if (flag.memory.task === 'harvest') {
                this.setTask('flag');
              }
            } else {
              // 
              // this.setTask('harvest', '🔄 harvest');
              // this.pushTask({ name: 'harvest' })
              // assign both drones with the harbest1
            }
          } else {

            if (this.isHome()) {
              const towers = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
              const tower = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: struct => struct.structureType === STRUCTURE_TOWER && struct.store.getFreeCapacity(RESOURCE_ENERGY) > 200,
              });
              const repairTargets = this.creep.room.find(FIND_MY_STRUCTURES, {
                filter: object => (object.hits / object.hitsMax) <= 0.25 && object.hits <= 25000,
              });
              const buildTargets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
              const spawnOrExtension = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
                  || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
              });
              const upgradeContainer = spawn.memory.upgradeContainer && Game.getObjectById(spawn.memory.upgradeContainer);

              if (false) {

              }
              else if (buildTargets && buildTargets.length) {
                if (LOG) console.log('build', buildTargets[0]);
                this.setTask('build', '🚧 build');
              }
              else if ((!towers || towers.length === 0) && (repairTargets && repairTargets.length)) {
                if (LOG) console.log('repair', repairTargets[0]);
                this.setTask('repair', '⚡ repair');
              }
              else if (spawnOrExtension) {
                if (LOG) console.log('unload2', spawnOrExtension);
                this.setTarget(spawnOrExtension.id);
                this.setTask('unload');
              }
              else if (tower) {
                if (LOG) console.log('unload', tower);
                this.setTarget(tower.id);
                this.setTask('unload');
              }
              else if (upgradeContainer && upgradeContainer.store.getFreeCapacity(RESOURCE_ENERGY) >= this.creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
                this.setTarget(upgradeContainer.id);
                this.setTask('unload');
              }
              else if (this.creep.room.controller.level <= 5 || (this.creep.room.controller.level > 5 && this.findStorage().store.getUsedCapacity(RESOURCE_ENERGY) > 100000)) {
                if (LOG) console.log('upgrade');
                this.setTask('upgrade');
              }
            } else {
              if (flag) {
                console.log('flag', flag.memory.task === 'harvest');
                if (flag.memory.task === 'harvest') {
                  this.setTarget(this.findStorage());
                  this.setTask('unload');
                }
              } else {
                // recharge?
              }
            }
          }
        } else {
          // if (this.hasTask('load') && this.isEnergyFull()) {
          //   this.enterStandby();
          // }
          // else if ((this.hasTask('repair') || this.hasTask('build') || this.hasTask('unload')) && this.isEnergyEmpty()) {
          //   this.enterStandby();
          // }
        }
        break;

      case 'upgrader':
        if (this.isStandby()) {
          if (!this.isEnergyFull()) {
            const controllerLink = spawn.memory.links.controllerLink && Game.getObjectById(spawn.memory.links.controllerLink);
            const upgradeContainer = spawn.memory.upgradeContainer && Game.getObjectById(spawn.memory.upgradeContainer);

            if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
              this.setTarget(controllerLink.id);
            } else if (upgradeContainer) {
              this.setTarget(upgradeContainer.id);
            }
            this.setTask('load', '🚚');
          } else if (this.isEnergyFull()) {
            this.setTask('upgrade', '⚡ upgrade');
          }
        }
        break;

      case 'miner':
        if (this.isStandby()) {
          if (this.canHarvest()) {
            this.setTask('harvest', '🔄 harvest');
          } else {
            if (this.creep.getActiveBodyparts(CARRY) > 0) {
              const { link, container } = this.getSourceStores();

              if (link && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                this.setTarget(link.id);
                this.setTask('unload');
              } else if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                this.setTarget(container.id);
                this.setTask('unload');
              } else {
                // note - miners could be updated to hold resources when the source is empty and the containers are full.
                const source = this.get('source') && Game.getObjectById(this.get('source'));
                if (source && source.mineralType) {
                  this.set('resource', source.mineralType);
                  this.setTarget(this.findStorage());
                  this.setTask('unload');
                } else {
                  this.setTask('drop');
                }
              }
            } else {
              // doesn't really happen; the drones just mine continuously
              this.setTask('drop');
            }
          }
        }
        break;

      case 'hauler':
        if (this.isStandby()) {
          if (this.isEnergyEmpty()) {
            // todo: haules without a source would work better with 2 part tasks. 
            //    A resource request is issued, maybe not task load?
            const source = Game.getObjectById(this.get('source'));

            if (source) {
              const sourceMem = source.id && spawn.memory.sources[source.id];
              const droppedResources = source.pos.findInRange(FIND_DROPPED_RESOURCES, 2, {
                filter: (resource) => resource.amount >= this.creep.store.getFreeCapacity(RESOURCE_ENERGY),
              });

              if (droppedResources && droppedResources.length) {
                this.setTarget(droppedResources[0].id);
                this.setTask('pickup');
              } else if (sourceMem.container) {
                this.setTarget(sourceMem.container);
                this.setTask('load');
                break;
              }
            } else if (!source) {
              const energizedStorage = this.findEnergizedStorage();
              const spawnNeedsEnergy = spawn.room.energyAvailable / spawn.room.energyCapacityAvailable <= 0.85
              const energizedContainer = global.Hive.getResourceContainer(spawn, this.creep.store.getFreeCapacity());

              let loadTarget;
              if (energizedContainer) {
                loadTarget = energizedContainer;
              } else if (energizedStorage && spawnNeedsEnergy) {
                loadTarget = energizedStorage;
              }

              if (loadTarget) {
                this.setTarget(loadTarget);
                this.setTask('load');
                break;
              }
            }
          } else {
            this.setTask('unload');
          }
        }
        break;

      case 'flagbearer':

        if (this.isStandby()) {
          if (flag) {
            const distanceToFlag = this.creep.pos.getRangeTo(flag);
            if (distanceToFlag <= 3) {
              this.setTask('claim');
            } else {
              // this.findPath(flag.pos);
              this.moveTo(flag);
            }
          }
        }
        break;

      default:
        break;
    }
  }

  /**
   * All tasks should run until they shift the bot into standby or another task
   */
  run() {
    try {
      this.keepAlive();

      if (this.hasTaskQueued()) {
        // console.log(this.name, this.task);
      } else {
        // the jobs currently doesn't operate using the task queue
        this.processJob();  
      }

      this.runTask();
    } catch (e) {
      // throw e;
      console.log(this.creep.name,':', e);
    }
  }
}

module.exports = Drone;
