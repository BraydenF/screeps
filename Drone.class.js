const BaseCreep = require('Creep.class');
const config = require('config');
const TaskController = require('TaskController');
const GameMap = require('GameMap');
const utils = require('utils');

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
// global.Spawn4.createDrone('builder', [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE,CARRY,MOVE,CARRY,MOVE,CARRY, MOVE, MOVE]);
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

// 
// 6830f65310e84dd6a6c7ccae
// global.Drone.getDrone('hauler-69679250-chan').setTaskQueue()
// 
// Assist mineral deposit - { homeRoom: 'W7N52', targetRoom: 'W3N50', source: '6847389d8863b9ed4022c9ae' }
// global.Spawn1.createDrone('hauler', [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE], { homeRoom: 'W7N52', targetRoom: 'W3N50', source: '6847389d8863b9ed4022c9ae' });
// 
// global.Spawn4.createDrone('flagbearer', [CLAIM,CLAIM,MOVE], {targetRoom:''});
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
  static getDrone(creepName) {
    const creep = Game.creeps[creepName];
    return new Drone(creep);
  }

  // todo: drones are being referenced by the Hive long after they are gone. This will likely need to be updated to an object instead of an Array to allow for removal of creeps
  static globalizeDrones() {
    if (!global.drones) global.drones = {};
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];

      if (!global.drones[name] && creep && creep.memory.role === 'drone') {
        const drone = new Drone(creep);
        global.drones[name] = drone;

        // distributes creeps to creeps to each room
        const hr = creep.memory.homeRoom;
        const key = `${hr}-creeps`;
        if (!global[key]) global[key] = {};
        global[key][name] = creep;
      }
    }
  }

  static runDrones(drones = {}) {
    for (const name in drones) {
      const drone = global.drones[name];
      if (drone && drone.creep) drone.run();
      else {
        global.drones[name] = undefined;
        const mem = Memory.creeps[name];
        if (mem) {
          const hr = Memory.creeps[name].homeRoom;
          global[`${hr}-creeps`][name] = undefined; 
        }
      }
    }
  }

  constructor(creep, job = null) {
    if (!creep) {
      throw new Error('Must supply a creep');
    } else if (typeof creep === 'string') {
      creep = Game.creeps[creepName];
      job = creep.memory.job;
    }

  	super(creep);
    const memory = creep.memory || {};
    const sources = creep.room.find(FIND_SOURCES);

    // pulls old job, new job can be passed to contrucor
    this.set('job', memory.job ? memory.job : job);
    // Game.rooms[memory.homeRoom]
    this.set('homeRoom', memory.homeRoom && Game.rooms[memory.homeRoom] ? memory.homeRoom : this.creep.room.find(FIND_MY_SPAWNS).onFirst(f => f.room.name));
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

  getEnergizedContainer(amount = null) {
    const spawn = this.getSpawn();
    const room = spawn && spawn.room;
    const source = this.getSource();
    const sourceMem = source && source.id && room && room.memory.sources && room.memory.sources[source.id];

    if (sourceMem && sourceMem.container) {
      return Game.getObjectById(sourceMem.container);
    } else if (room && room.memory.sources) {
      const containers = [];

      Object.keys(room.memory.sources).forEach(source => {
        const mem = room.memory.sources[source];
        const container = mem.container && Game.getObjectById(mem.container);
        if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > amount ? amount : 0) {
          containers.push(container);
        }
      });

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

  // getSourceTarget(sourceId = null) {
  //   if (!sourceId) source = this.get('source');
  //   const source = sourceId && Game.getObjectById(sourceId);
  //   const droppedResources = source.pos.findInRange(FIND_DROPPED_RESOURCES, 2);
  //   const sourceMem = source && source.id && spawn.memory.sources[source.id];
  //   const container = sourceMem && sourceMem.container && Game.getObjectById(sourceMem.container);
  //   if (droppedResources) {
  //     return droppedResources.id;
  //   } else if ()
  // }

  processJob() {
    this.job = this.get('job');
    const spawn = this.getSpawn();
    const LOG = false;
    const flag = this.getFlag();
    const storage = this.getStorage();
    const source = this.getSource();
    const room = this.creep.room;
    const controller = room.controller;
    const targetRoom = this.get('targetRoom');
    const travelTime = this.get('travelTime');
    const isStandby = this.isStandby();

    // drones 
    // if (targetRoom && this.creep.room.name !== targetRoom) {
    //   this.moveToRoom(targetRoom);
    //   return;
    // }

    switch(this.get('job')) {
      case 'mechanic':
      case 'drone':
        // console.log(this.creep.name, this.isStandby(), this.isEnergyEmpty())
        // if I swap the order and use the task queue I can shift, but not resolve the duplicate task issue
        
        if (isStandby) {
          if (targetRoom) {
            if (this.creep.room.name === targetRoom) {
              // what should I do boss?
              if (this.isEnergyEmpty()) {
                const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if (droppedResources) {
                  this.setTask('pickup');
                  break;
                }

                if (source) {
                  this.setTask('harvest', source.id);
                  break;
                }
              }

            } else {
              this.moveToRoom(targetRoom);
              return;
            }
          }

          if (this.isEnergyEmpty()) {
            // todo: Update drones to use the task queue to allow for more complex task assignment.
            //    get energy => build, repair, chargeSpawn, chargeTower, chargeUpgrader, upgrade
            //        -- I wonder if ideally this is done with a task queue ran by the hive somehow --
            const storageEnergy = storage && storage.store.getUsedCapacity(RESOURCE_ENERGY);
            const sourceMem = source && room && room.memory.sources && room.memory.sources[source.id];
            const miner = !sourceMem || (sourceMem && sourceMem.miner && Game.creeps[sourceMem.miner]);
            const salvage = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
              filter: tombstone => tombstone.store.getFreeCapacity(RESOURCE_ENERGY) !== tombstone.store.getCapacity(RESOURCE_ENERGY),
            });

            const nonEnergy = Object.keys(this.creep.store);
            if (nonEnergy && nonEnergy.length && storage) {
              Object.keys(this.creep.store).forEach(resource => {
                this.pushTask({ name: 'unload', target: storage.id, resource: resource });
              });
              break;
            }

            // dumps energy from storage into the spawn
            const lowRoomEnergy = room.energyAvailable < room.energyCapacityAvailable;
            if (lowRoomEnergy && spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && storageEnergy > 20000) {
              this.setTask('load');
              this.setTarget(storage.id);
              break;
            }

            if (salvage) {
              let capacity = this.getFreeCapacity();
              Object.keys(salvage.store).forEach(resource => {
                if (salvage.store[resource] < capacity) {
                  capacity = capacity - salvage.store[resource];
                  this.pushTask({ name: 'load', target: salvage.id, resource: resource });
                }
              });
              break;
            }

            const container = this.getEnergizedContainer(this.getFreeCapacity());
            if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > this.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
              this.setTask('load', container.id);
              break;
            }

            const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            if (droppedResources) {
              this.setTask('pickup');
              break;
            }

            if (source && !miner) {
              this.setTask('harvest', source.id);
              break;
            } else if (flag) {
              if (flag.memory.task === 'harvest') {
                this.setTask('flag');
                break;
              } else if (flag.memory.task === 'build') {
                this.setTask('harvest');
                break;
              }
            }

            // I'd like to make sure there is something to do.
            if (this.room.terminal && storage && this.room.terminal.store['energy'] > storage.store.getUsedCapacity(RESOURCE_ENERGY)) {
              this.setTask('load');
              this.setTarget(terminal.id);
            } else
            if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 20000) {
              // build targets are now in the room memory!
              const buildTargets = room.find(FIND_CONSTRUCTION_SITES);
              if (buildTargets && buildTargets.length || lowRoomEnergy) {
                this.setTask('load');
                this.setTarget(storage.id);
                // this.pushTask({ name: 'build' });
                break;
              }

              break;
            }
          } else {
            if (this.isHome()) {
              // const taskController = new TaskController(this.creep.room);

              // if (taskController.peekTasks()) {
              //   let energyAvailable = this.creep.store.getUsedCapacity(RESOURCE_ENERGY);

              //   while (energyAvailable && taskController.peekTasks()) {
              //     const task = taskController.peekTasks();
              //     if (task.resource === RESOURCE_ENERGY && task.amount <= energyAvailable) {
              //       this.pushTask(taskController.getTask());
              //       energyAvailable = energyAvailable - task.amount;
              //     }
              //   }
              // }

              // I am next to my container and it needs repair
              if (source) {
                const sourceMem = source && source.id && room && room.memory.sources && room.memory.sources[source.id];
                const container = sourceMem && sourceMem.container && Game.getObjectById(sourceMem.container);
                const repairAmount = this.getUsedCapacity() * 100;
                if (container && container.hits < 200000 && (container.hitsMax - container.hits > repairAmount)) {
                  this.setTask('repair', container);
                  break;
                }
              }

              const spawnOrExtension = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
                  || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
              });
              if (spawnOrExtension) {
                this.setTask('unload', spawn.store.getFreeCapacity(RESOURCE_ENERGY) >= 50 ? spawn.id : spawnOrExtension.id);
                break;
              }

              const repairTargets = room.find(FIND_MY_STRUCTURES, {
                filter: struct => {
                  const miscTarget = (struct.hits / struct.hitsMax) <= 0.25 && struct.hits <= 20000;
                  const containers = struct.structureType === STRUCTURE_CONTAINER && struct.hits < 155000;
                  const ramparts = struct.structureType === STRUCTURE_RAMPART && struct.hits <= 25000;
                  const tunnel = struct.structureType === STRUCTURE_ROAD && struct.hits > 5000 && struct.hits < 600000;
                  return miscTarget || ramparts || containers || tunnel;
                },
              });
              if (repairTargets && repairTargets.length) {
                const nearest = this.creep.pos.findClosestByPath(repairTargets);
                this.setTask('repair', nearest, '⚡ repair');
                break;
              }

              // note: consider updating drones to use the hive memory
              const buildTargets = room.find(FIND_CONSTRUCTION_SITES);
              if (buildTargets && buildTargets.length) {
                // NOTE: consider adding build priority
                this.setTask('build', null, '🚧 build');
                break;
              }

              const towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
              const lowEnergyTower = this.findLowEnergyStore(towers);
              if (lowEnergyTower) {
                this.setTask('unload', lowEnergyTower.id);
                break;
              }

              // power spawn
              const powerSpawn = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } }).onFirst(f => f);
              if (powerSpawn && powerSpawn.store['energy'] <= 3500) {
                this.setTask('unload', powerSpawn.id);
                break;
              }

              const upgradeContainer = room.memory.upgradeContainer && Game.getObjectById(room.memory.upgradeContainer);
              if (upgradeContainer && upgradeContainer.store.getFreeCapacity(RESOURCE_ENERGY) >= this.getUsedCapacity(RESOURCE_ENERGY)) {
                this.setTask('unload', upgradeContainer.id);
                break;
              } else if (controller.my && controller.level <= 5) {
                this.setTask('upgrade');
                break;
              }

              // falls back on base unload target assignment
              this.setTask('unload');
              break;
            } else {
              if (flag) {
                if (flag.memory.task === 'harvest') {
                  this.setTask('moveTo', spawn);
                  break;
                } else if (flag.memory.task === 'build') {
                  const buildTargets = room.find(FIND_CONSTRUCTION_SITES);
                  if (buildTargets.length > 0) this.setTask('build', buildTargets[0]);
                }
              } else {
                // recharge?
              }
            }
          }
        }
        break;

      case 'upgrader':
        if (isStandby) {
          if (this.creep.ticksToLive < 100) {
            const nearbyResource = this.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 2).onFirst(f => f);
            if (nearbyResource) {
              this.setTask('pickup', nearbyResource, 'yoink!');
              this.pushTask({ name: 'unload', resource: nearbyResource.resourceType, target: this.getStorage().id });
            }
          }
          if (this.isEnergyFull()) {
            this.setTask('upgrade', null, '⚡ upgrade');
          } else {
            const controllerLink = room.memory.links && room.memory.links.controllerLink && Game.getObjectById(room.memory.links.controllerLink);
            const upgradeContainer = room.memory.upgradeContainer && Game.getObjectById(room.memory.upgradeContainer);

            let target = null;
            if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
              this.setTask('load', controllerLink.id, '🚚');
            } else if (upgradeContainer && upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
              this.setTask('load', upgradeContainer.id, '🚚');
            }
          } 
        }
        break;

      case 'miner':
        if (isStandby) {
          // outer room mining operations
          if (targetRoom) {
            // if (this.creep.ticksToLive <= 2) {
            //   if (Object.keys(this.creep.store).length > 0) {
            //     // TODO: target the hauler with the least space
            //     const nearbyHauler = this.creep.pos.findClosestByPath(FIND_MY_CREEPS, { filter: { memory: { job: 'hauler', targetRoom } } });
            //     if (nearbyHauler) {
            //       this.setTask('unload', nearbyHauler);
            //       this.set('resource', Object.keys(this.creep.store)[0]);
            //     }
            //   }
            // }

            // travel to the indicated source
            if (this.creep.room.name === targetRoom) {
              const homeroomMem = this.get('homeRoom') && Memory.rooms[this.get('homeRoom')];
              if (source) this.moveTo(source);

              if (this.canHarvest()) {
                if (!travelTime) this.set('travelTime', 1500 - this.creep.ticksToLive);
                this.setTask('harvest');
              } else {
                const haulers = this.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: { memory: { job: 'hauler', targetRoom } } })
                .sort((a, b) => {
                  return a.store.getFreeCapacity('energy') - b.store.getFreeCapacity('energy');
                });

                const parts = this.parts;
                if (haulers.length > 0 && haulers[0].store.getFreeCapacity() !== 0) {
                  this.setTask('unload', haulers[0].id);
                  this.set('resource', this.getFirstResource());
                }
                else if (parts.move / parts.total >= 0.4) {
                  // If I dont have a nearby hauler, am I forced to return to the storage?
                  this.setTask('unload', this.get('targetStore') || this.getStorage().id);
                  this.set('resource', this.getFirstResource()); 
                }
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }

          // internal mining operations
          
          const { link, container } = this.getSourceStores();

          if (this.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            let nearbyStores = this.get('nearbyStores');
            if (nearbyStores) {
              nearbyStores = nearbyStores.map(id => Game.getObjectById(id));
            } else {
              nearbyStores = this.creep.pos.findInRange(FIND_MY_STRUCTURES, 1);
              this.set('nearbyStores', nearbyStores.map(s => s.id));
            }
            const nearbyEmptyStores = nearbyStores.filter(structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && ((link && structure.id !== link.id) || (container && structure.id !== container.id)));

            // I have energy
            if (nearbyEmptyStores.length > 0) {
              this.setTask('unload', nearbyEmptyStores[0].id);
              break;
            } else if (link && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
              this.setTask('unload', link.id);
              break;
            } else if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
              this.setTask('unload', container.id);
              break;
            // } else if (container && container.hits < 200000 && (container.hitsMax - container.hits > this.getUsedCapacity() * 100)) {
            //   this.setTask('repair', container.id);
            //   break;
            } else {
              // note - miners could be updated to hold resources when the source is empty and the containers are full.
              if (source && source.mineralType) {
                this.setTask('unload', this.get('container') || this.getStorage());
                this.set('resource', source.mineralType);
              } else {
                this.setTask('drop');
              }
            }
          } else {
            // note: right-to-repair of the container was taken away with the removal of picking up energy
            // const nearbyResource = this.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 2).onFirst(f => f);
            // if (nearbyResource && container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            //   this.pickup(nearbyResource); // prevents decay when container is empty.
            // } else
            // I do not have energy
            if (this.canHarvest() && source && (source.energy > 0 || source.mineralAmount > 0)) {
              if (!travelTime) this.set('travelTime', 1500 - this.creep.ticksToLive);
              this.setTask('harvest', null, '🔄 harvest');
            } else if (source.mineralAmount === 0 && source.ticksToRegeneration >= this.creep.ticksToLive) {
              this.setTask('reclaim');
            }
            break;
          }
        }
        break;

      // case '':
      //   if (targetRoom && source) {
      //     const container = this.get('container');
      //     if (container) {
      //       this.setTask('load', container);
      //     }
      //   }
      //   break;

      case 'hauler':
        if (isStandby) {
          if (targetRoom) {
            if (this.creep.ticksToLive <= travelTime * 1.25 && travelTime) {
              const resources = Object.keys(this.creep.store);
              if (resources.length > 0) {
                this.setTask('unload', this.getStorage().id);
                this.set('resource', resources[0]);
                this.set('targetRoom', undefined);
              } else if (this.creep.ticksToLive <= travelTime) {
                this.creep.suicide();
                // this.setTask('reclaim');
                // this.set('targetRoom', undefined);
              }
            }

            // travel to the indicated source
            if (this.creep.room.name === targetRoom) {
              if (!travelTime) this.set('travelTime', 1500 - this.creep.ticksToLive);
              const homeroomMem = this.get('homeRoom') && Memory.rooms[this.get('homeRoom')];

              if (source) {
                const container = this.get('container');
                if (container) {
                  this.setTask('load', container);
                }

                const nearbyCreep = source.pos.findInRange(FIND_MY_CREEPS, 1).onFirst(f => f);
                if (nearbyCreep ? !this.creep.pos.inRangeTo(nearbyCreep, 1) : !this.creep.pos.inRangeTo(source, 2)) {
                  this.moveTo(nearbyCreep || source);
                }

                const salvage = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                  filter: tombstone => tombstone.store.getFreeCapacity(RESOURCE_ENERGY) !== tombstone.store.getCapacity(RESOURCE_ENERGY),
                });
                if (salvage) {
                  this.setTask('load', salvage.id);
                  this.set('resource', salvage.store[0]);
                }

                if (nearbyCreep && nearbyCreep.store[source.depositType] > 0 && this.getFreeCapacity(RESOURCE_ENERGY) < 0) {
                  nearbyCreep.memory.taskQueue = [{ name: 'unload', target: this.creep.id, resource: source.depositType }];
                }
              } else if (this.creep.memory.powerBank) {
                const bank = Game.getObjectById(this.creep.memory.powerBank);
                if (bank) {
                  this.moveTo(bank);
                  break;
                } else if (this.getFreeCapacity('power') <= 0) {
                  this.setTask('unload', storage.id);
                  this.set('resource', 'power');
                  break;
                } else {
                  const droppedResources = this.creep.room.find(FIND_DROPPED_RESOURCES, { filter: { resourceType: 'power' }});
                  if (droppedResources.length > 0) {
                    this.moveTo(droppedResources[0]);
                    this.setTask('pickup', droppedResources[0].id);
                    this.set('resource', 'power');
                    this.setTaskQueue([{ task: 'unload', target: storage.id, resource: 'power' }]);
                    break;
                  } else if (droppedResources.length === 0) {
                    if (this.creep.store.getUsedCapacity('power') > 0) {
                      this.setTask('unload', storage.id);
                      this.set('resource', 'power'); 
                    } else {
                      this.setTask('reclaim');
                    }
                    break;
                  }
                }
              }

              if (this.getFreeCapacity(RESOURCE_ENERGY) <= 50) {
                const targetStore = this.get('targetStore') && Game.getObjectById(this.get('targetStore'));
                const tar = targetStore && targetStore.store.getFreeCapacity(RESOURCE_ENERGY) > this.getUsedCapacity()
                  ? targetStore.id
                  : this.getStorage().id;
                this.setTask('unload', tar);
                this.set('resource', Object.keys(this.creep.store)[0]);
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }
          // note: feature is disabled to save cpu while not in use
          //  else if (this.get('mode') === 'transfer') {
          //   const plan = this.get('plan') || { resource: 'energy' };

          //   if (this.isEmpty()) {
          //     // const homeStorage = this.get('homeRoom') && Game.rooms[this.get('homeRoom')].storage;
          //     if (plan.fromStore) {
          //       this.setTask('load', plan.fromStore);
          //       this.set('resource', plan.resource);
          //     }
          //   } else {
          //     this.setTask('unload', plan.targetStore);
          //     this.set('resource', plan.resource);
          //   }
          //   break;
          // }

          // todo: use the task controller to get a task

          if (this.isEmpty()) {
            if (source) {
              const sourceMem = source.id && room.memory.sources && room.memory.sources[source.id];
              const droppedResources = source.pos.findInRange(FIND_DROPPED_RESOURCES, 2, {
                filter: (resource) => resource.amount >= this.creep.store.getFreeCapacity(RESOURCE_ENERGY),
              });

              if (droppedResources && droppedResources.length) {
                this.setTask('pickup', droppedResources[0].id);
              } else if (sourceMem && sourceMem.container) {
                this.setTask('load', sourceMem.container);
                break;
              }
            } else if (!source) {
              const links = spawn.room.memory.links;
              const mainLink = links && links.mainLink && Game.getObjectById(links.mainLink);
              if (mainLink && mainLink.store.getUsedCapacity(RESOURCE_ENERGY) > 250) {
                this.setTask('load', mainLink);
                break;
              }

              const droppedResource = this.creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
              if (droppedResource) {
                this.setTask('pickup', droppedResource);
                break;
              }

              const energizedContainer = this.getEnergizedContainer(this.getFreeCapacity());
              if (energizedContainer) {
                this.setTask('load', energizedContainer);
                break;
              }

              const storage = this.getStorage();
              if (storage && storage.store.getFreeCapacity('energy') >= 1000) {
                const mineral = spawn.room.find(FIND_MINERALS).onFirst(m => m);
                const mineralContainer = mineral.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
                if (mineralContainer && mineralContainer.store[mineral.mineralType] >= this.getFreeCapacity()) {
                  this.setTask('load', mineralContainer.id);
                  this.set('resource', mineral.mineralType);
                  // this.pushTask({ name: 'unload', target: this.getStorage().id, resource: mineral.mineralType });
                  break;
                } else if (mineralContainer && mineralContainer.store['energy'] >= this.getFreeCapacity()) {
                  this.setTask('load', mineralContainer.id);
                  break;
                }
              }

              const spawnNeedsEnergy = spawn.room.energyAvailable / spawn.room.energyCapacityAvailable <= 0.85;
              if (spawnNeedsEnergy) {
                const terminal = this.creep.room.terminal;
                const freeCapacity = this.creep.store.getFreeCapacity('energy');
                const targetStore = terminal && storage && terminal.store['energy'] >= storage.store['energy'] ? terminal : storage;
                // console.log(this.creep.name, 'targetStore', targetStore, freeCapacity, targetStore.store.getUsedCapacity('energy'))
                if (targetStore && targetStore.store.getUsedCapacity('energy') > freeCapacity ) {
                  // console.log(this.creep.name, 'targetStore', targetStore)
                  this.setTask('load', targetStore.id);
                  break;
                }
              }

              const salvage = this.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                // filter: tombstone => {
                  // tombstone.store.getFreeCapacity(RESOURCE_ENERGY) !== tombstone.store.getCapacity(RESOURCE_ENERGY),
                // }
              });
              if (salvage && Object.keys(salvage.store).length > 0) {
                let capacity = this.getFreeCapacity();
                Object.keys(salvage.store).forEach(resource => {
                  if (salvage.store[resource] < capacity) {
                    capacity = capacity - salvage.store[resource];
                    this.pushTask({ name: 'load', target: salvage.id, resource: resource });
                  }
                });

                this.getStorage() && this.pushTask({ name: 'unload', target: this.getStorage().id });
                break;
              }

              const ruin = this.creep.pos.findClosestByPath(FIND_RUINS, {
                filter: ruin => ruin.store.getUsedCapacity() > 0,
              });
              if (ruin) this.setTask('load', ruin);
            }

            // low energy tower
            if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 20000) {
              const towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
              const lowEnergyTower = this.findLowEnergyStore(towers, this.creep.store.getFreeCapacity(RESOURCE_ENERGY));
              if (lowEnergyTower) {
                this.setTask('load', storage);
                this.pushTask({ name: 'unload', target: lowEnergyTower.id });
                break;
              }
            }

            // const roomMem = this.get('homeRoom') && Memory.rooms[this.get('homeRoom')];
            // if (roomMem && roomMem.unloadRequest) {
            //   // something has requested to be unloaded
            //   this.setTask('load', roomMem.unloadRequest);
            //   Memory.rooms[this.get('homeRoom')].unloadRequest = undefined;
            // }

            // console.log(this.creep.name, 'nothing to do!');
          } else {
            // todo: task controller getEnergy
            // unloading logic
            const resources = Object.keys(this.creep.store);
            if (this.isEnergyEmpty() && resources.length && resources[0] !== 'energy') {
              this.setTask('unload');
              this.set('resource', resources[0]);
              if (this.room.storage.store.getFreeCapacity(resources[0]) >= 1000) {
                this.setTarget(this.getStorage());
              } else if (this.room.terminal && this.room.terminal.store.getFreeCapacity(resources[0]) >= 1000) {
                this.setTarget(this.room.terminal.id);
              }
            }

            this.setTask('unload');
          }
        }
        break;

      case 'keeper':
        if (isStandby && targetRoom) {
        // outer room mining operations
          // if (this.creep.ticksToLive <= 3) {
          //   if (Object.keys(this.creep.store).length > 0) {
          //     // TODO: target the hauler with the least space
          //     const nearbyHauler = this.creep.pos.findClosestByPath(FIND_MY_CREEPS, { filter: { memory: { job: 'hauler', targetRoom } } });
          //     if (nearbyHauler) {
          //       this.setTask('unload', nearbyHauler);
          //       this.set('resource', Object.keys(this.creep.store)[0]);
          //     }
          //   }
          // }

          // travel to the indicated source
          if (this.creep.room.name === targetRoom) {
            const homeroomMem = this.get('homeRoom') && Memory.rooms[this.get('homeRoom')];
            if (source) this.moveTo(source);

            if (this.canHarvest()) {
              if (!travelTime) this.set('travelTime', 1500 - this.creep.ticksToLive);
              this.setTask('harvest');
            } else {
              const container = this.creep.memory.container ? Game.getObjectById(this.creep.memory.container) : (() => {
                const container = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).first();
                if (container) this.creep.memory.container = container.id;
                return container;
              })();

              if (container) {
                if (container.hits < 200000) {
                  this.setTask('repair', container.id);
                } else if (container.store.getFreeCapacity('energy') !== 0) {
                  this.setTask('unload', container.id);
                  this.set('resource', this.getFirstResource());
                }
              } else {
                const buildTargets = this.creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 3);
                if (buildTargets.length > 0) {
                  this.setTask('build', buildTargets[0]);
                  break;
                }

                const haulers = this.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: { memory: { job: 'hauler', targetRoom } } })
                  .sort((a, b) => {
                    return a.store.getFreeCapacity('energy') - b.store.getFreeCapacity('energy');
                  });
                if (haulers.length > 0 && haulers[0].store.getFreeCapacity() !== 0) {
                  this.setTask('unload', haulers[0].id);
                  this.set('resource', this.getFirstResource());
                  break;
                }
              }
            }
          } else {
            this.moveToRoom(targetRoom);
          }
          break;
        }
        break;

      case 'builder':
        if (isStandby && this.isHome()) {
          if (this.isEmpty()) {
            const storage = this.getStorage();

            if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
              this.setTask('load', storage.id);
            } else {
              const container = this.getEnergizedContainer(this.getFreeCapacity());
              if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > this.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
                this.setTask('load', container.id);
                break;
              }

              const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
              if (droppedResources) {
                this.setTask('pickup');
                break;
              }
            }
          } else {
            // instead of 
            let buildTargets = room.memory['build-targets'].length ? room.memory['build-targets'].reduce((acc, id) => {
              const target = Game.getObjectById(id);
              if (target) {
                acc.push(target);
              } else {
                room.memory['build-targets'][id] = undefined;
              }
              return acc;
            }, []) : this.room.find(FIND_CONSTRUCTION_SITES);

            if (buildTargets.length > 0 && buildTargets[0]) {
              // this.setTask('build', this.creep.pos.findClosestByPath(buildTargets).id);
              this.setTask('build', buildTargets[0].id);
              // console.log(room.name, 'nearest', this.creep.pos.findClosestByPath(buildTargets).id);
            } else {
              // move repair targets to a by the room 
              const repairTargets = room.find(FIND_STRUCTURES, { filter: (struct) => {
                const minimumDamage = (struct.hitsMax - struct.hits) >= 1000; // max heal is 800
                const walls = struct.structureType === STRUCTURE_WALL && struct.hits < 1000000
                const ramparts = struct.structureType === STRUCTURE_RAMPART && struct.hits <= 1000000;

                return minimumDamage && (walls || ramparts);
              }});
              const target = this.creep.pos.findClosestByRange(repairTargets);
              if (target) this.setTask('repair', target);
            }
          }
        }
        break;

      case 'scavenger':
        // console.log('sdasdasdadasd');
        if (isStandby) {
          // outer room mining operations
          if (targetRoom) {
            // end of life sequence
            if (travelTime && this.creep.ticksToLive <= (travelTime * 1.2)) {
              if (Object.keys(this.creep.store).length > 0) {
                const nearbyHauler = this.creep.pos.findClosestByPath(FIND_MY_CREEPS, { filter: { memory: { job: 'hauler', targetRoom } } });
                if (nearbyHauler) {
                  this.setTask('unload', nearbyHauler);
                  this.set('resource', Object.keys(this.creep.store)[0]);
                }
              }
            }

            // travel to the indicated source
            if (this.creep.room.name === targetRoom) {
              if (source) this.moveTo(source);

              if (this.canHarvest()) {
                if (!travelTime) {
                  this.set('travelTime', 1500 - this.creep.ticksToLive);
                  GameMap.buildRoad(this.creep.pos, source);
                }
                this.setTask('harvest');
              } else {
                const nearbyHauler = this.creep.pos.findClosestByPath(FIND_MY_CREEPS, {
                  filter: { memory: { job: 'hauler', targetRoom } },
                });

                if (nearbyHauler && nearbyHauler.store.getFreeCapacity() !== 0) {
                  this.setTask('unload', nearbyHauler.id);
                  this.set('resource', Object.keys(this.creep.store)[0]);
                } else {
                  const parts = this.parts;
                  const buildTarget = this.creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                  const repairTarget = this.creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                    filter: struct => {
                      const miscTarget = (struct.hits / struct.hitsMax) <= 0.25 && struct.hits <= 20000;
                      const containers = struct.structureType === STRUCTURE_CONTAINER && struct.hits < 155000;
                      const ramparts = struct.structureType === STRUCTURE_RAMPART && struct.hits <= 25000;
                      const tunnel = struct.structureType === STRUCTURE_ROAD && struct.hits > 5000 && struct.hits < 600000;
                      return miscTarget || ramparts || containers || tunnel;
                    },
                  });

                  if (buildTarget) {
                    this.setTask('build');
                    this.setTarget(buildTarget.id);
                    break;
                  } else if (repairTarget) {
                    this.setTask('repair');
                    this.setTarget(repairTarget.id);
                  } else if (parts.move / parts.total >= 0.4) {
                    this.setTask('unload', this.get('targetStore') || this.getStorage().id);
                    this.set('resource', Object.keys(this.creep.store)[0]); 
                  }
                }
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }
        }

      case 'power':
        if (isStandby && this.isHome()) {
          const powerSpawn = Game.getObjectById(room.memory.powerSpawn.id);
          if (powerSpawn) {
            if (this.isEmpty()) {
              const storage = this.getStorage();
              if (powerSpawn.store['power'] <= 50 && storage.store['power'] > 0) {
                this.setTask('load', storage.id);
                this.set('resource', 'power');
              } else if (powerSpawn.store['energy'] < 1000 && storage.store['energy'] >= 50) {
                this.setTask('load', storage.id);
              } else if (storage.store['power'] <= 0) {
                this.setTask('reclaim')
              }
            } else {
              const resources = Object.keys(this.creep.store);
              this.setTask('unload', powerSpawn.id);
              this.set('resource', resources[0]);
            }
          }
        }
        break;

      case 'soldier':
        // soldier things.
        // I should have logic for looking at my nearby targets within my actual attack range, and finding targets that are farther out.
        // ranged attack distance is 3 squares

        if (isStandby) {
          if (targetRoom) {
            if (this.creep.room.name === targetRoom) {
              // note: I need a better solution to waiting
              // let supported = !this.creep.memory.supported;
              // if (this.creep.memory.supported) {
              //   supported = this.creep.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'healer', targetRoom } } });
              // }
              // if (this.creep.memory.powerBank) {
                  // 
              // }
              if (this.creep.memory.powerBank) {
                const pb = Game.getObjectById(this.creep.memory.target);
                if (pb) {
                  if (this.creep.pos.isNearTo(pb)) {
                    if (!this.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: { memory: { job: 'healer', targetRoom } } })) {
                      break; // wait to attack
                    }
                    this.setTask('attack', this.creep.memory.target);
                  } else {
                    this.moveTo(pb);
                  }
                } else {
                  this.setTask('reclaim');
                }

              } else if (this.creep.memory.target && this.creep.pos.isNearTo(Game.getObjectById(this.creep.memory.target))) {
                this.setTask('attack', this.creep.memory.target);
              } else if (!this.creep.memory.target) {
                this.setTask('siege');
              } else if (Game.getObjectById(this.creep.memory.target)) {
                this.moveTo(this.creep.memory.target);
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }

          // identify hostiles
          // const hostileHealer = this.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, { filter: (creep) => creep.getActiveBodyparts(HEAL) > 0 });
          // const closestHostile = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
          //   filter: (creep) => creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0,
          // });
          // const flagbearer = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(CLAIM) > 0 });
          // this.setTask('attack', (hostileHealer || closestHostile) || flagbearer);
        }
        break;

      case 'ranger':
        // soldier things.
        // I should have logic for looking at my nearby targets within my actual attack range, and finding targets that are farther out.
        // ranged attack distance is 3 squares

        if (isStandby) {
          if (targetRoom) {
            if (this.creep.room.name === targetRoom) {

              if (this.creep.memory.source) {
                const source = this.creep.memory.source && Game.getObjectById(this.creep.memory.source);

                console.log('source', source);
                const nearbyEnemies = source.pos.findInRange(FIND_HOSTILE_CREEPS, 5)
                if (nearbyEnemies[0]) {
                  this.setTask('range-attack', nearbyEnemies[0]);
                  break;
                } else {
                  if (source && !source.pos.inRangeTo(target, 3)) {
                    this.creep.moveTo(source)
                  }
                }

              } else if (this.creep.memory.target) {
                const target = Game.getObjectById(this.creep.memory.target);
                if (target) {
                  this.setTask('range-attack', target);
                }
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }

          // identify hostiles
          // const hostileHealer = this.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, { filter: (creep) => creep.getActiveBodyparts(HEAL) > 0 });
          // const closestHostile = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
          //   filter: (creep) => creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0,
          // });
          // const flagbearer = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(CLAIM) > 0 });
          // this.setTask('attack', (hostileHealer || closestHostile) || flagbearer);
        }
        break;

      case 'healer': 
        if (isStandby) {
          if (targetRoom) {
            if (this.creep.room.name === targetRoom) {
              const target = this.creep.memory.target
                ? Game.getObjectById(this.creep.memory.target)
                : this.creep.room.find(FIND_MY_CREEPS).onFirst(f => f);
              // console.log('target', target);
              if (this.creep.pos.inRangeTo(target, 5)) {
                this.setTask('heal');
              } else {
                this.moveTo(target);
              }

              if (this.creep.memory.powerBank && !Game.getObjectById(this.creep.memory.powerBank)) {
                this.setTask('reclaim');
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }
        }
        break;

      case 'hguard': 
        if (isStandby) {
          if (targetRoom) {
            if (this.creep.room.name === targetRoom) {
              const target = this.creep.memory.source && Game.getObjectById(this.creep.memory.source);
              console.log('target', target);
              if (this.creep.pos.inRangeTo(target, 5)) {
                this.setTask('heal');
              } else {
                this.moveTo(target);
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }
        }
        break;

      case 'scout':
        // scouts can have different tasks like keeping a room 
        // scout halls - Move to the nearest hallway and go towards the corner
        // - notes the rooms with resources in them in memory, with how long they are expected to exist.
        // - goes through portal?
        // 
        // The scout targets the nearest corner. W0N50 ->
        const mode = this.get('mode');

        if (isStandby) {
          if (targetRoom) {
            if (this.creep.room.name === targetRoom) {
              if (!travelTime) this.set('travelTime', 1500 - this.creep.ticksToLive);
              if (this.creep.room.controller) this.moveTo(this.creep.room.controller);

              if (mode === 'scan-halls') {
                // const nearestHall = GameMap.findNearestHallway(this.creep.room.name);
                // when a scout arrives in a target room, probably a corner, find another room to travel to
              }
            } else {
              this.moveToRoom(targetRoom);
            }
            break;
          }
        }

        break;

      case 'flagbearer':
        if (isStandby) {
          if (this.creep.room.name === targetRoom) {
            const controller = this.creep.room.controller;
            if (this.creep.pos.isNearTo(controller)) {
              if (flag) {
                this.setTask('claim');
              } else if (controller.reservation && controller.reservation.username === 'Invader') {
                // this.setTask('attackController');
                this.creep.attackController(controller);
              } else {
                this.setTask('reserve');
              }
            } else {
              this.moveTo(controller);
            }
          } else {
            this.moveToRoom(targetRoom);
          }

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
      const prevCpu = this.get('totalCpu');
      let cpu = Game.cpu.getUsed();
      // this.init();

      // if (this.creep.memory.targetRoom && Game.cpu.bucket < 40) {
      //   return; // external creeps turn off before internal creeps
      // }

      // if (Game.cpu.tickLimit < 1) return console.log(Game.cpu.tickLimit);
      // this.eolSequence();
      // if (utils.roll() > 96) this.creep.say(utils.randomSay());

      // testing a small cpu cost for checking what job thing to do
      if (this.isStandby()) {
        if (!this.hasTaskQueued() && Game.cpu.bucket > 40) {
          this.processJob();
        } else if (this.hasTaskQueued() && Game.cpu.bucket > 20) {
          this.processQueue();
        }
      } else {
        this.runTask();
      }

      // stat tracking!
      const totalCpu = prevCpu + (Game.cpu.getUsed() - cpu);
      this.set('totalCpu', totalCpu);
      this.set('avgCpu', totalCpu / this.creep.ticksToLive);
    } catch (e) {
      // console.log(`${this.name} ${this.creep.room.name}`,':', e);
      throw e;
    }
  }
}

module.exports = Drone;
