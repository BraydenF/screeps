const config = require('config');
const droneService = require('drone.service');
const towerService = require('tower.service');
const labController = require('lab.controller');
// const LabController = require('lab.controller');

const { INITIAL_SPAWN } = config;
const MAX_MINER_COST = 600;

// notes on current and future memory tracking needs
const miningTeam = { source: null, miner: null, hauler: null, link: null };

const defaultMemory = {
  toSpawn: { job: '', cost: 300 },
  miningTeams: {},
  upgradeContainer: null,
  upgradeLink: null,
  upgrader: null,
  extractor: null,
};

// global.Spawn2.createDrone('miner', [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY]);
// global.Spawn2.createDrone('upgrader', [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY]);

class TaskManager {
  // a set of tasks being issued to creeps on the rooms behalf.
  // this could include the energy requests, labs, 
}

class Hive {
  static getCreeps(spawn) {
    const creeps = [];
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (creep.memory.homeRoom === spawn.room.name) {
        creeps.push(creep);
      }
    }
    return creeps;
  }

  static getResourceContainer(spawn, minAmount = 50) {
    let container;
    spawn.room.find(FIND_SOURCES).forEach(source => {
      const mem = spawn.memory.sources[source.id];
      const temp = mem.container && Game.getObjectById(mem.container);
      if (temp && temp.store.getUsedCapacity(RESOURCE_ENERGY) > minAmount) {
        container = temp;
      }
    });
    return container;
  }

  static labReport(spawn) {
    const mem = spawn.memory.labController;
    if (mem.job) {
      return `${mem.job.action} - ${mem.job.resource} - ${mem.job.status}`;
    } else {
      return 'no active job';
    }
  }

  constructor(spawnName) {
    this.spawn = Game.spawns[spawnName];
    this.roomName = this.spawn.room.name;

    if (typeof global[spawnName] === 'undefined') global[spawnName] = {};
    global[spawnName].createDrone = droneService.createDroneFactory(this.spawn);
    global[spawnName].runLab = labController.startLabFactory(this.spawn);
    global[spawnName].deal = function (orderId, amount) {
      return Game.market.deal(orderId, amount, this.roomName);
    }
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

  getTowers() {
    return this.getRoom().find(FIND_MY_STRUCTURES, { filter: (structure) => structure.structureType === STRUCTURE_TOWER });
  }

  getMyCreeps() {
    const creeps = [];
    Game.creeps.forEach(creep => {
      if (creep.memory.homeRoom === this.spawn.name) creeps.push(creep);
    });
    return creeps;
  }

  reclaimCreep(targetId) {
    const toRecycle = Game.getObjectById(targetId);
    if (toRecycle) this.spawn.recycleCreep(toRecycle);
  }

  canSpawn(cost) {
    return !this.spawn.spawning && this.spawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
  }

  createDrone(job, cost) {
    return global[this.spawn.name].createDrone(job, cost);
  }

  spawnCreep() {
    const toSpawn = this.get('toSpawn');
    if (toSpawn && Game.time % 5 === 0) {
      const res = this.createDrone(toSpawn.job, toSpawn.cost);

      if (res.status === OK) {
        this.set('toSpawn', undefined);
      }
    }
  }

  getEnergyStatus() {
    let status;
    if (this.spawn.room.energyAvailable < 300) {
      status = 'low-energy';
    } else if (this.spawn.room.energyAvailable >= 300) {
      status = 'energized';
    } else if (this.spawn.room.energyAvailable === this.spawn.room.energyCapacityAvailable) {
      status = 'full-energy';
    }
    return status
  }

  getUpgradeContainer() {
    let upgradeContainer = Game.getObjectById(this.get('upgradeContainer'));

    if (!upgradeContainer) {
      const controller = this.getController();
      const nearestContainer = controller.pos.findClosestByPath(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } });

      if (nearestContainer && nearestContainer.pos.inRangeTo(controller, 3)) {
        upgradeContainer = nearestContainer;
        this.set('upgradeContainer', upgradeContainer.id);
      }
    }

    return upgradeContainer;
  }

  manageControllerLevel() {
    // todo: in the future it may be necessary to position this container adjacent to the controller
    const controller = this.getController();
    const upgradeContainer = this.getUpgradeContainer();
    const upgrader = this.spawn.pos.findClosestByRange(FIND_MY_CREEPS, { filter: (creep) => creep.memory.job === 'upgrader' });

    // if (the controller has no adjacent container) create a container construction

    if (Game.time % 10 === 0&& upgradeContainer && this.getController().level >= 2 && !upgrader && upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) >= 1200) {
      console.log('should spawn upgeade', this.canSpawn());
      const energyCapacity = this.spawn.room.energyCapacityAvailable;
      if (this.canSpawn()) this.createDrone('upgrader', energyCapacity <= 1000 ? energyCapacity : 1000);
    }

    if (upgrader && upgradeContainer) {
      // conscripts a hauler to deposit into the upgrader container
      const containerHauler = this.get('containerHauler');

      if (!containerHauler) {
        const hasLowEnergy = upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) <= 1000;
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
          this.set('containerHauler', undefined);
          console.log('hauler released');
        }
      }
    }
  }

  // todo: consider changing spawning logic to ensure 
  manageResources() {
    // handles energy resource logic
    const sources = this.get('sources') || {};
    for (const source of this.getRoom().find(FIND_SOURCES)) {
      let mem = sources[source.id] || { drone: null, miner: null, hauler: null };

      // finds nearby mining containers
      source.pos.findInRange(FIND_STRUCTURES, 2, {
        filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
      }).onFirst((first) => mem.container = first.id);

      // finds nearby link
      source.pos.findInRange(FIND_STRUCTURES, 2, {
        filter: (structure) => structure.structureType === STRUCTURE_LINK,
      }).onFirst((first) => mem.link = first.id);

      // assigns and spawns drones to gather energy from assigned sources
      if (!mem.drone || !Game.creeps[mem.drone]) {
        let creep = source.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.job === 'drone' && creep.memory.source === source.id,
        });

        if (!creep) {
          creep = source.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.job === 'drone' && !creep.memory.source,
          });
        }

        if (creep) {
          creep.memory.source = source.id;
          mem.drone = creep.name;
        } else {
          mem.drone = null;
          if (this.canSpawn() && Game.time % 10 === 0) this.createDrone('drone', this.spawn.room.energyCapacityAvailable);
        }
      }

      if (!mem.miner || !Game.creeps[mem.miner]) {
        let creep = source.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.job === 'miner' && creep.memory.source === source.id,
        });

        if (!creep) {
          creep = source.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.job === 'miner' && !creep.memory.source,
          });
        }

        if (creep) {
          creep.memory.source = source.id;
          mem.miner = creep.name;
        } else {
          mem.miner = null;
          if (this.canSpawn() && Game.time % 10 === 0) {
            const minerCost = mem.container || mem.link ? 1200 : 600;
            this.createDrone('miner', minerCost);
          }
        }
      }

      if ((!mem.hauler || !Game.creeps[mem.hauler]) && !mem.link) {
        let creep = source.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.job === 'hauler' && creep.memory.source === source.id,
        });

        if (!creep) {
          creep = source.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.job === 'hauler' && !creep.memory.source,
          });
        }

        if (creep) {
          creep.memory.source = source.id;
          mem.hauler = creep.name;
        } else {
          mem.hauler = null;
          const energyLimit = this.spawn.room.energyCapacityAvailable < 1250 ? this.spawn.room.energyCapacityAvailable : 1250
          if (this.canSpawn() && Game.time % 10 === 0) this.createDrone('hauler', energyLimit);
        }
      }

      sources[source.id] = mem;
    }

    this.set('sources', sources);
  }

  manageLinks() {
    const links = this.get('links') || {};

    if (Game.time % 10 === 0) {
      const sourceLinks = [];
      this.getRoom().find(FIND_SOURCES).forEach(source => {
        source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
          filter: (structure) => structure.structureType === STRUCTURE_LINK,
        }).onFirst(link => sourceLinks.push(link.id));
      });
      links.sourceLinks = sourceLinks;

      // finds the controller link
      this.getController().pos.findInRange(FIND_MY_STRUCTURES, 1, {
        filter: (structure) => structure.structureType === STRUCTURE_LINK,
      }).onFirst(link => links.controllerLink = link.id);

      // finds the spawn link
      this.spawn.pos.findInRange(FIND_MY_STRUCTURES, 1, {
        filter: (structure) => structure.structureType === STRUCTURE_LINK,
      }).onFirst(link => links.spawnLink = link.id);
    }

    const controllerLink = links.controllerLink && Game.getObjectById(links.controllerLink);
    const sourceLinks = links.sourceLinks.map(id => Game.getObjectById(id));

    if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 400) {
      // requests energy from a resource
      const fromLink = controllerLink.pos.findClosestByRange(sourceLinks, { filter: (link) => {
        return link.cooldown === 0 && link.store.getUsedCapacity(RESOURCE_ENERGY) >= controllerLink.store.getFreeCapacity();
      }});

      // console.log('fromLink', fromLink);
      if (fromLink) {
        fromLink.transferEnergy(controllerLink);
      }
    }
  }

  captureRoom(flag) {
    // todo: reserve the room
    if (typeof flag.memory !== 'object') flag.memory = { flagbearer: null, drone: null };

    if (flag.room && flag.room.controller.my) {
      // build spawn
      const spawnSite = flag.room.findClosestByRange(FIND_CONSTRUCTION_SITES, { filter: (site) => site.structureType === STRUCTURE_SPAWN });
      if (!spawnSite) {
        flag.room.createConstructionSite(flag.room.pos, STRUCTURE_SPAWN, flag.memory.spawnName);
      }

      const drone = Game.creeps[flag.memory.drone];
      // assign a drone to assist

      if (drone) {
        if (drone.memory.task === 'recharge') {
          flag.memory.drone = null;
          drone.memory.flag = undefined;
        }
        // do I need to do anything if I have a drone?
        // probably just ensure that the drone can keep working, or unassign when it needs to reharge
      } else {
        const creep = this.spawn.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (creep) => creep.ticksToLive >= 1250 && creep.memory.job === 'drone' && creep.memory.task === 'standby',
        });
        if (creep) {
          creep.memory.flag = `capture-${this.spawn.name}`;
          creep.memory.task = 'flag';
        }
      }
    } else {
      // the room isn't claimed; spawn the flagbearer and assign to the flag
      const flagbearer = flag.memory.flagbearer && Game.creeps[flag.memory.flagbearer];

      if (!flagbearer) {
        if (flag.memory.flagbearer) flag.memory.flagbearer = null;

        const creep = this.spawn.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.job === 'flagbearer' && (!creep.memory.flag || creep.memory.flag === flag.name),
        });

        if (creep) {
          flag.memory.flagbearer = creep.name;
          creep.memory.flag = flag.name;
        } else {
          if (Game.time % 5 === 0) this.createDrone('flagbearer', 650, { flag: flag.name });
        }
      }
    }

    // delete flag
  }

  run() {
    try {
      // const labController = new Labcontroller();
      // labController.run();

      // const storage = this.spawn.pos.findClosestByPath(FIND_STRUCTURES, {
      //   filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 50
      // });
      // if (storage && this.spawn.store.getUsedCapacity(RESOURCE_ENERGY) < 300) {
      //   this.spawn.store.withdraw(storage);
      // }

      // constantly tries to heal the nearest creep
      const nearbyCreep = this.spawn.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: (creep) => creep.ticksToLive <= 1400 && creep.getActiveBodyparts(CLAIM) === 0,
      });
      if (nearbyCreep && this.spawn.pos.isNearTo(nearbyCreep)) {
        nearbyCreep.memory.homeRoom = this.spawn.room.name; // takes ownership of creep
        const rechargeAttempt = this.spawn.renewCreep(nearbyCreep);

        if (rechargeAttempt === OK && nearbyCreep.memory.task === 'recharge' && nearbyCreep.ticksToLive >= 1400) {
          nearbyCreep.memory.task = 'standby';
        }
      }

      const towers = this.getRoom().find(FIND_MY_STRUCTURES, { filter: (structure) => structure.structureType === STRUCTURE_TOWER });
      towers && towers.forEach((tower) => {
        towerService.run(tower);

        // conscripts a hauler to load the tower
        towerService.manageHauler(this, tower);
      });

      this.manageResources();
      this.manageControllerLevel();
      this.manageLinks();
      labController.run(this);


      const captureFlag = Game.flags[`capture-${this.spawn.name}`];
      if (captureFlag) this.captureRoom(captureFlag);
    } catch (e) {
      throw e;
      console.log(this.spawn.name, e.toString());
    }
  }

  report() {
    if (Game.time % 5 === 0) {
      console.log('*****************************************************************');
      console.log(`<b>${this.spawn.name}'s energy:</b> ${this.spawn.room.energyAvailable} / ${this.spawn.room.energyCapacityAvailable}`);
      // todo: add info on creeps
    }
  }
}

module.exports = Hive;
