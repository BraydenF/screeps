
// I suppose the logic here should be used by all systems of the room where possible. 
// Towers - energy requests & repair targets
// Labs - jobs
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

  constructor(room) {
    if (room && room.name) {
      if (!room.memory) room.memory = {};
      const spawns = room.find(FIND_MY_SPAWNS);

      this.room = room;
      this.spawn = spawns.length && spawns[0];
    } else {
      throw 'TaskController';
    }
  }

  refresh(hive) {
    this.room = hive.room;
    this.spawn = hive.spawn;
  }

  get(key) {
    return this.room.memory[key];
  }

  set(key, value) {
    this.room.memory[key] = value;
  }

  getFreeDrone() {
    const drones = this.room.find(FIND_MY_CREEPS, { filter: (creep) => {
      if (!creep.memory.targetRoom && (creep.memory.job === 'drone' || creep.memory.job === 'hauler')) {
        return creep.memory.task === 'standby'
          && Object.keys(creep.store).length === 0
          && (!creep.memory.taskQueue || creep.memory.taskQueue.length === OK);
      }
    }});

    return drones.length > 0 ? new global.Drone(drones[0]) : null;
  }

  getMaintenanceTask(drone) {
    let buildTargets = this.getBuildTargets(this.room);
    if (buildTargets.length > 0) {
      return { task: 'build', target: buildTargets[0].id };
    }

    const repairTargets = this.getRepairTargets();
    if (repairTargets && repairTargets.length > 0) {
      const nearest = Game.cpu.bucket >= 5100 && drone
        ? drone.creep.pos.findClosestByPath(repairTargets.slice(0, 3))
        : repairTargets[0];
      if (nearest) return { task: 'repair', target: nearest };
    }
  }

  getBuildTargets() {
    const mem = this.room.memory;
    return mem['build-targets'] ? mem['build-targets'].reduce((acc, id) => {
      const target = Game.getObjectById(id);
      if (target) {
        acc.push(target);
      } else {
        this.room.memory['build-targets'][id] = undefined;
      }
      return acc;
    }, []) : [];
  }

  getRepairTargets() {
    let repairTargets = this.room.find(FIND_STRUCTURES, { filter: (struct) => {
      const minimumDamage = (struct.hitsMax - struct.hits) >= 1000; // max heal is 800
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
    }}).sort((a, b) => a.hits - b.hits);
    return repairTargets;
  }

  findNearestEnergy(drone) {
    // the Drone is passed to assist in finding the closest appropriate energy source for his work
  }

  getResourceUnloadTarget(resource) {
    // if the terminal needs the resource it goes there first
    const requestedResources = this.room.memory.terminal && this.room.memory.terminal.requestedResources || {};
    if (room.terminal && this.room.terminal.store[resource] <= requestedResources[resource]) {
      return this.room.terminal;
    } else {
      return this.room.storage;
    }
  }

  // if i stringify tasks would that be better?
  createLoadTask(target, resource = RESOURCE_ENERGY, amount = null) {
    return { name: 'load', target: target.id, resource, amount: amount };
  }

  createUnloadTask(target, resource = RESOURCE_ENERGY, amount = null) {
    return { name: 'unload', target: target.id, resource, amount };
  }

  createTransferTask(resource, from, to) {
    const loadTask = this.createLoadTask(from, resource);
    const unloadTask = this.createUnloadTask(to, resource);
    return [loadTask, unloadTask];
  }

  issueTask(task, message) {
    const drone = this.getFreeDrone();
    if (drone) {
      if (drone.creep.store.getUsedCapacity('energy') >= 0) task = [this.createUnloadTask(this.room.storage, 'energy'), ...task];
      drone.setTaskQueue(task);
      if (message) drone.creep.say(message);
      return drone.creep.name;
    }
    return false;
  }

  getLabTask() {
    const labsMem = this.room.memory.labController && this.room.memory.labController.labs;
    if (labsMem) {
      for (const id in labsMem) {
        let task = labsMem[id].storeTask;
        if (task) {
          labsMem[id].storeTask = null;
          return task;
        }
      }
    }
  }

  getTaskAssignment(drone) {
    let loadTask;
    let unloadTask;
    // 
    // charge Hive
    // repair things
    // build things
    // charge towers
    // charge controller container
    // 
    // salvage tombestone
    // lab stuff
    // terminal things
    // 
    // I need energy
    // check tombstones
    // If I have a source, check around it for energy
    // else check storage
    // else pickup
    // else no_source check
    // else harvest flag
    // 
    
    return [loadTask, unloadTask];
  }

  getTask() {
    const tasks = {
      towers: {
        '6838c31cef66bd7525d086e4': undefined,
        '6838c31cef66bd7525d086ed': 50,
        '683cef415b14a126c7aebd67': 'drone-23634834-chan',
      },
    };

    // tasks.towers.
  }

  getEnergySource(target) {
    // find the closest source of energy to the target
    // mainLink, sourceContainers, sourceLinks, droppedResources
  }

  getRoomMaintenanceTask() {
    const room = this.creep.room;
    const memory = room.memory;
            // how can I best prevent this search with out adding it to too many ticks

      // Ideally I am 
    // if (room.memory.mode === 'power') {
    //   // prioritize getting energy to the
    // } else {

    // }

    // if I am in power mode I want to give energy to the
    // const goo = room.energyCapacityAvailable - room.energyAvailable;
    let extensionOrSpawn;
    if (room.energyCapacityAvailable - room.energyAvailable > 0) {
      extensionOrSpawn = room.find(FIND_STRUCTURES, {
        filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
          || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
      });
      if (extensionOrSpawn) return extensionOrSpawn;
    }

    // if there are enemies this needs to be the highest priotity
    let nearestTower;
    if (memory.tEnergy) {
      const lowEnergyTowers = Object.keys(memory.tEnergy).map(id => Game.getObjectById(id));
      // nearestTower = lowEnergyTowers.length > 0 ? this.creep.pos.findClosestByRange(lowEnergyTowers) : null;
      // if (nearestTower) return nearestTower; 
    }

    // extensionOrSpawn
    // nearestTower, lowEnergyTowers[0]
    // if (hostilesDetected -> towers, mode===power -> extensions)
    // is it always extensions by default? or towers?
    // if (extensionOrSpawn || lowEnergyTowers.length > 0) {

    // }

    if (memory.labEnergy) {
      const lowEnergyLab = Object.keys(memory.labEnergy).first();
      if (lowEnergyLab) {
        return lowEnergyLab;
      }
    }

    const terminal = this.creep.room.terminal;
    // todo: update to the requestedResources amount
    if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
      return terminal;
    }

    const factory = memory.factory && Game.getObjectById(memory.factory.id);
    if (factory && factory.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
      return factory;
    }

    // todo: power spawn needs energy
  }

  getHaulerTask() {
    // I am an empty hauler that is looking to ove goods.
    // energy transfers: extensions -> towers -> 
    const tasks = this.get('tasks');
    if (Object.keys(tasks).length > 0) {
      // I have tasks
    }
  }

  generateTasks() {
    let tasks = this.get('tasks') || {};

    this.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        // extensions
        switch(structure.structureType) {
          case STRUCTURE_TOWER:
            if (structure.store.getUsedCapacity(RESOURCE_ENERGY) < 400) {
              // tasks.towers[structure.id] = this.createUnloadTask(structure, RESOURCE_ENERGY, structure.store.getFreeCapacity(RESOURCE_ENERGY));  
            } else if (tasks.towers[structure.id]) {
              tasks.towers[structure.id] = undefined;
            }
            break;

          case STRUCTURE_SPAWN:
            // how do I ensure that this task isn't being used
            if (structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50) {
              // tasks.main[structure.id] = this.createUnloadTask(structure, RESOURCE_ENERGY, structure.store.getFreeCapacity(RESOURCE_ENERGY));
            }
            break;

          case STRUCTURE_EXTENSION:
            if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
              // tasks.main[structure.id] = this.createUnloadTask(structure, RESOURCE_ENERGY, structure.store.getFreeCapacity(RESOURCE_ENERGY));
            }
            break;
        }

        // if (structure.structureType === STRUCTURE_TOWER && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 400) {
        // }
        // if (structure.structureType === STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50) {
        //   tasks.main[structure.id] = this.createUnloadTask(structure, RESOURCE_ENERGY, structure.store.getFreeCapacity(RESOURCE_ENERGY));
        // } else if () {

        // }
        // return (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
        //   || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
        // }
    }});

    // todo: for CPU purposes, loop over structures once to find all low power structures, figure out how to return them in a particular order?
    // if (!tasks.towers) tasks.towers = {};
    // this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).forEach(tower => {
    //   if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 400) {
    //     tasks.towers[tower.id] = this.createUnloadTask(tower, RESOURCE_ENERGY, tower.store.getFreeCapacity(RESOURCE_ENERGY));
    //     // newTasks.push(this.createUnloadTask(tower, RESOURCE_ENERGY, tower.store.getFreeCapacity(RESOURCE_ENERGY)));
    //   }
    // });

    // this.room.find(FIND_CONSTRUCTION_SITES).forEach(site => {
    //   let task = { name: 'build', target: site.id };
    //   newTasks.push(this.createUnloadTask(site));
    // });

    // if (this.spawn.store.getFreeCapacity() > 0) {
    //   // newTasks.push(this.createUnloadTask(spawn, RESOURCE_ENERGY, this.spawn.store.getFreeCapacity()));
    // }

    this.room.find(FIND_STRUCTURES, {
      filter: (structure) => (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
    }).forEach(extension => {
      // newTasks.push(this.createUnloadTask(extension));
    });

    const upgradeContainer = this.spawn.room.memory.upgradeContainer && Game.getObjectById(this.spawn.room.memory.upgradeContainer);
    if (upgradeContainer && upgradeContainer.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      // newTasks.push(this.createUnloadTask(upgradeContainer));
    }

    // this doesn't fit the theme of tasks here.
    // const tombstones = this.room.find(FIND_TOMBSTONES, {
    //   filter: tombstone => tombstone.store.getUsedCapacity() > 0,
    // }).forEach(tombstone => {
    //   Object.keys(salvage.store).forEach(resource => {
    //     newTasks.push(this.createLoadTask(tombstone, resource));
    //   });
    // });

    this.set('tasks', newTasks);
  }

  run() {
    // todo
  }
}

module.exports = TaskController;
