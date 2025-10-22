
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
      this.tasks = new global.Queue(room.memory.tasks || []);
    } else {
      throw 'TaskController';
    }
  }

  get(key) {
    return this.room.memory[key];
  }

  set(key, value) {
    this.room.memory[key] = value;
  }

  addTask(task) {
    if (typeof task !== 'string') task = JSON.stringify(task);
    this.tasks.enqueue(task);
  }

  getTask() {
    let task = this.tasks.dequeue();
    if (typeof task === 'string') task = JSON.parse(task);
    return task;
  }

  peekTasks() {
    let task = this.tasks.peek();
    if (typeof task === 'string') task = JSON.parse(task);
    return task;
  }

  getFreeDrone() {
    const drones = this.room.find(FIND_MY_CREEPS, { filter: (creep) => {
      if (!creep.memory.targetRoom && (creep.memory.job === 'drone' || creep.memory.job === 'hauler')) {
        const drone = new global.Drone(creep);
        return !drone.hasTaskQueued() && drone.isEmpty();
      }
    }});

    return drones.length > 0 ? new global.Drone(drones[0]) : null;
  }

  findNearestEnergy(drone) {
    // the Drone is passed to assist in finding the closest appropriate energy source for his work
  }

  // if i stringify tasks would that be better?
  createLoadTask(target, resource = RESOURCE_ENERGY, amount = null) {
    return { name: 'load', target: target.id, resource, amount: amount || target.store.getFreeCapacity(resource) };
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
