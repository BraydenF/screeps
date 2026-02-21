const config = require('config');
const droneService = require('drone.service');
const towerService = require('tower.service');
const observerService = require('observer.service');
const roomSupport = require('roomSupport.service');

const GameMap = require('GameMap');
const FactoryController = require('FactoryController');
const LabController = require('LabController');
const MarketController = require('MarketController');
const SpawnController = require('SpawnController');
const TaskController = require('TaskController');
const TerminalController = require('TerminalController');
const PowerSpawnController = require('PowerSpawnController');

const { INITIAL_SPAWN } = config;
const DEFAULT_EXTERNAL_SOURCE = { stats: { energySpent : 0, energyCollected: 0, minerCount: 0 } };

const MODICONS = {
  standard: '🔘',
  expanding: '🏗️',
  reinforcing: '🧿',
  recovery: '🩹',
  defend: '🛡️',
  power: '🔴',
  idk: '💠',
}

const creepHasAged = (name) => {
  const hauler = Game.creeps[name];
  return hauler.ticksToLive <= 1200
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

  get config() {
    return config.rooms[this.room.name] || {};
  }

  get room() {
    return Game.rooms[this.roomName];
  }

  get controller() {
    return this.room.controller;
  }

  get drones() {
    return global[`${this.roomName}-drones`];
  }

  get storage() {
    return this.room.storage;
  }

  get terminal() {
    return this.room.terminal;
  }

  get global () {
    return global.rooms[this.roomName];
  }

  constructor(roomName) {
    this.roomName = roomName;
    this.spawns = this.room.find(FIND_MY_SPAWNS);
    this.spawn = SpawnController.getPrimarySpawn(this.room, this.spawns);
    this.spawnController = new SpawnController(this);

    this.taskController = new TaskController(this.room);
    this.labController = new LabController(this);
    this.powerSpawnController = new PowerSpawnController(this);

    if (!this.spawn) return; // ends initilization early

    // initialize the global object for using Hives from the terminal
    this.nickname = this.room.memory.nickname || this.spawnController.getSpawn().name;
  }

  init() {
    const roomObj = {};
    this.creeps = {};
    const key = `${this.roomName}-creeps`;
    for (const name in global[key]) {
      const creep = Game.creeps[name];
      if (creep) {
        this.creeps[name] = creep;
      } else {
        global[key][name] = undefined;
      }
    }

    this.spawn = SpawnController.getPrimarySpawn(this.room, this.spawns);
    this.spawnController.sync(this);
    this.taskController.refresh(this);
    roomObj.taskController = this.taskController;

    roomObj.towers = [];
    (this.get('towers') || []).forEach(tId => {
      const tower = Game.getObjectById(tId);
      if (tower) roomObj.towers.push(tower);
    });
    if (!roomObj.towers || Game.time % 999 === OK) {
      roomObj.towers = this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
      this.set('towers', roomObj.towers.map(t => t.id));
    }

    // roomObj.extensions = (this.get('extensions') || []).map(tId => Game.getObjectById(tId));
    // if (!roomObj.extensions || Game.time % 998 === OK) {
    //   roomObj.extensions = this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
    //   this.set('extensions', extensions.map(e => e.id));
    // }

    if (this.controller.level >= 7) {
      const factoryMem = this.room.memory.factory || {};
      this.factory = factoryMem.id ? Game.getObjectById(factoryMem.id) : this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } }).onFirst(f => f);
      roomObj.factory = this.factory;
      if (!this.factoryController && this.factory) this.factoryController = new FactoryController(this.factory);
    }

    if (this.room.terminal) {
      if (this.terminalController) {
        this.terminalController.init(this.room.terminal);
      } else {
        this.terminalController = new TerminalController(this.room.terminal);
      }
    }

    global.rooms[this.roomName] = roomObj;
  }

  get(key) {
    return this.room.memory[key];
  }

  set(key, value) {
    this.room.memory[key] = value;
  }

  getSpawn(pos = null) {
    // todo: update to use the controller to get the desired spawn.
    return this.spawnController.getSpawn();
  }

  getExtractor() {
    let extractor = this.get('extractor') && Game.getObjectById(this.get('extractor'));
    if (!extractor) {
      extractor = this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR }}).onFirst(s => s);
      if (extractor) this.set('extractor', extractor.id);
    }

    return extractor;
  }

  findCreepWithSource(job, sourceId) {
    return this.room.find(FIND_MY_CREEPS, { filter: { memory: { job, source: sourceId } } });
  }

  getCreepWithSource(job, sourceId) {
    const name = Object.keys(this.creeps).find(name => {
      const mem = this.creeps[name] && this.creeps[name].memory;
      if (mem && mem.job === job && mem.source === sourceId) return this.creeps[name];
    });
    return name && Game.creeps[name];
  }

  getEnergyPercentage() {
    const room = this.room;
    return room.energyAvailable / room.energyCapacityAvailable;
  }

  getEnergyStatus() {
    const room = this.room;
    let status;

    if (room.energyAvailable < 300) {
      status = 'low-energy';
    } else if (room.energyAvailable > 300 && this.getEnergyPercentage() > .75) {
      status = 'energized';
    } else if (room.energyAvailable === room.energyCapacityAvailable) {
      status = 'full-energy';
    }

    return status
  }

  resourceAmount(resource) {
    let total = 0;
    if (this.storage) {
      total = total + this.storage.store[resource];  
    }

    if (this.terminal) {
      total = total + this.terminal.store[resource];  
    }
    return total;
  }

  findCreeps(filterFunc) {
    const names = Object.keys(this.creeps);
    return names.filter(name => filterFunc(Game.creeps[name]));
  }

  addDrone(drone) {
    const key = `${this.roomName}-drones`;
    global[key][drone.name] = drone;
  }

  getControllerContainer() {
    let container = Game.getObjectById(this.get('upgradeContainer'));

    if (!container) {
      const controller = this.controller;
      const nearestContainer = controller.pos.findClosestByPath(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } });

      if (nearestContainer && nearestContainer.pos.inRangeTo(controller, 3)) {
        container = nearestContainer;
        this.set('upgradeContainer', container.id);
      }
    }

    return container;
  }

  getControllerLink() {
    const linkMem = this.get('links');
    return linkMem && linkMem.controllerLink && Game.getObjectById(linkMem.controllerLink);
  }

  manageControllerLevel() {
    if (Game.time % 50 !== OK) return;
    let cpu = Game.cpu.getUsed();

    // this is probably a bit CPU hit..
    const upgraders = this.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'upgrader' } } });
    const controllerContainer = this.getControllerContainer();
    const controllerLink = this.getControllerLink();

    // NOTE: controller level 8 changes
    // - reclaim the container
    // - only spawn a creep when the downgrade timer is under a certain threshold OR raising GCL

    // the link or container has energy stored up
    const energyReserved = (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400)
      || (controllerContainer && controllerContainer.store.getUsedCapacity(RESOURCE_ENERGY) >= 1000);

    if (energyReserved) {
      // if (the controller has no adjacent container) create a container construction
      let upgraderNeedsReplaced = upgraders.length === 0;
      const sourceIds = Object.keys(this.get('sources') || {});

      if (sourceIds.length === 1) {
        upgraderNeedsReplaced = upgraders.length === 0;
      } else if (this.controller.level === 8) {
        // todo: update the rate based on energy storage
        if (false) {
          upgraderNeedsReplaced = upgraders.length === 0 || (upgraders.length === 1 ? upgraders[0] && upgraders[0].ticksToLive <= 750 : false);
        } else {
          upgraderNeedsReplaced = upgraders.length === 0;
        }
      } else if (this.controller.level <= 4) {
        upgraderNeedsReplaced = upgraders.length < 3;
      } else {
        upgraderNeedsReplaced = upgraders.length === 0 || (upgraders.length === 1 ? upgraders[0] && upgraders[0].ticksToLive <= 750 : false);
      }

      if (upgraderNeedsReplaced) {
        this.spawnController.spawnUpgrader();
      }
    }

    this.set('_controllerCpu', Game.cpu.getUsed() - cpu);
  }

  getSourceMem() {
    let sourceMem = this.get('sources') || {};
    if (Object.keys(sourceMem).length === OK) {
      sourceMem = this.room.find(FIND_SOURCES).reduce((acc, s) => {
        acc[s.id] = {};
        return acc;
      }, {});
    }
    return sourceMem
  }

  manageSources() {
    let nextManageSource = this.get('nextManageSource') || Game.time;
    const sourcesMem = this.getSourceMem();

    if (nextManageSource <= Game.time) {
      const room = this.room;
      nextManageSource = Game.time + 33;
      let nextDeathTime = 1500;

      for (const sourceId in sourcesMem) {
        const source = Game.getObjectById(sourceId);
        let mem = sourcesMem[sourceId];

        let container = mem.container && Game.getObjectById(mem.container);
        const containerEnergy = container ? container.store.getUsedCapacity('energy') : 0;
        if (!container) {
          source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
          }).onFirst((first) => {
            container = first;
            mem.container = first.id
          });
        }

        let link = mem.link && Game.getObjectById(mem.link);
        if (!link && this.controller.level >= 5) {
          source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (structure) => structure.structureType === STRUCTURE_LINK,
          }).onFirst((first) => mem.link = first.id); 
        }

        let nearestSpawn = mem.nearestSpawn && Game.getObjectById(mem.nearestSpawn);
        if ((!nearestSpawn || nearestSpawn === this.spawn.id) && this.spawns.length > 1) {
          nearestSpawn = source.pos.findClosestByRange(this.spawns);
          if (nearestSpawn) mem.nearestSpawn = nearestSpawn.id;
        }

        let miner = mem.miner && Game.creeps[mem.miner];
        if (!miner) {
          miner = this.findCreepWithSource('miner', source.id).onFirst(creep => {
            mem.miner = creep.name;
            return creep;
          });
        }

        // creates haulers for each source, if there is energy or a miner
        if (this.controller.level <= 5 && (miner || (!miner && containerEnergy > 1000))) {
          const haulers = roomSupport.getWorkers(mem, 'haulers');
          const droppedEnergy = source.pos.findInRange(FIND_DROPPED_RESOURCES, 2, { filter: { resourceType: 'energy' } }).first();
          const desiredHaulerCount = droppedEnergy && droppedEnergy.amount >= 1500 ? 3 : 1;
          if (haulers.length < desiredHaulerCount) {
            const maxCost = this.room.energyCapacityAvailable < 1000 ? this.room.energyCapacityAvailable : 1000;
            const cost = this.room.energyAvailable < maxCost ? this.room.energyAvailable : maxCost;

            if (this.spawnController.canSpawn(cost)) {
              const res = this.spawnController.spawnHauler(cost, { source: source.id }, true);
              if (res && res.status === OK) {
                haulers.push(res.name);
              }
            }
          } else {
            // if (hauler.ticksToLive <= nextDeathTime) {
              // nextDeathTime = hauler.ticksToLive;
              nextManageSource = Game.time + 100;
            // }
          }
        }

        if (!miner || (miner && miner.ticksToLive < 50)) {
          const spawn = nearestSpawn ? nearestSpawn : this.spawn;
          let minerCost = mem.link && this.room.energyCapacityAvailable >= 1200 ? 1200 : 550;
          if (this.room.energyAvailable === 300) minerCost = 300;
          if (!spawn.spawning) {
            let body = minerCost !== 300 ? [...w5, MOVE] : [WORK, WORK, MOVE];
            if (this.controller.level >= 5 && minerCost >= 1200) {
              body = [...w5, WORK, WORK, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY];
            }

            const res = global[spawn.name].createDrone('miner', body, { source: source.id });
            if (res.status === OK) mem.miner = res.name;
          }
        } else if (miner) {
          if (miner.ticksToLive <= (nextDeathTime - 50)) {
            // nextDeathTime = miner.ticksToLive;
            // nextManageSource = Game.time + nextDeathTime - 50;
            nextManageSource = Game.time + 100;
          }
        }
        sourcesMem[source.id] = mem;
      }

      this.set('nextManageSource', nextManageSource + 33);
      this.set('sources', sourcesMem);
    }

    return sourcesMem;
  }

  manageExternalSources() {
    const externalSources = this.get('externalSources') || {}
    for (const roomName in externalSources) {
      let { sources, level, stats, disabled, roads, nextCheck } = externalSources[roomName];
      const room = Game.rooms[roomName];
      if (disabled || !((nextCheck || 0) < Game.time)) return;

      let mineable = !level || level < 3;
      if (level && level >= 3) {
        // manage controller reservation and defend from invasion
        mineable = roomSupport.assertAuthority(this, room);
      }

      // don't create the keepers and haulers if the room isn't ready.
      if (sources && mineable) {
        externalSources[roomName].sources = sources.map(sourceMem => {
          if (typeof sourceMem === 'string') sourceMem = { id: sourceMem, cost: 0, collected: 0 };
          if (sourceMem.disabled) return sourceMem;

          if (level && level >= 3) {
            roomSupport.runKeeperTeam(this, room, sourceMem);
          } else if (true) {
            // todo: update to require a certain energy minimum to ensure spawns will work.
            // roomSupport.simpleMiningTeam(this, room, sourceMem);
          }
          return sourceMem;
        });
      }
    }

    this.set('externalSources', externalSources);
  }

  manageMineral() {
    let nextMineralOperation = this.get('nextMineralOperation');
    if (nextMineralOperation && Game.time < nextMineralOperation) return;

    const mem = this.get('mineral') || {};
    const mineral = (mem.id && Game.getObjectById(mem.id)) || (() => {
      const mineral = this.room.find(FIND_MINERALS).onFirst(m => m);
      if (mineral) mem.id = mineral.id;
      return mineral;
    })();

    if (mineral.ticksToRegeneration) {
      this.set('nextMineralOperation', Game.time + mineral.ticksToRegeneration);
    } else {
      this.set('nextMineralOperation', Game.time + 100);
    }

    const extractor = this.getExtractor();
    const memCan = mem.container && Game.getObjectById(mem.container);
    const container = memCan ? memCan : (() => {
      const container = mineral.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
      if (container) mem.container = container.id;
      return container;
    })();

    if (extractor && container) {
      if (mineral.mineralAmount <= this.storage.store.getFreeCapacity(mineral.mineralType)) {
        const memMiner = this.get('mineralMiner') && Game.getObjectById(this.get('mineralMiner'));
        const miner = memMiner || this.room.find(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.job === 'miner' && creep.memory.source === mineral.id,
        });

        if (!miner.length || miner.ticksToLive < 100) {
          const spawn = (mem.spawn || this.spawns.length > 1) ? (() => {
            let spawn = Game.spawns[mem.spawn];
            if (!spawn) {
              spawn = extractor.pos.findClosestByRange(this.spawns);
              mem.spawn = spawn.name;
            }
            return spawn;
          })() : this.spawn;

          if (this.spawnController.canSpawn(1250) && !spawn.spawning) {
            let body = [...w5, ...w5, MOVE, MOVE, MOVE, MOVE, MOVE]; // 1250
            if (this.spawnController.canSpawn(1800)) body = [...w5, ...w5, ...w5, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]; // 1800
            const res = global[spawn.name].createDrone('miner', body, { source: mineral.id, container: container.id });
            if (res.status === OK) {
              this.set('nextMineralOperation', Game.time + 1410);
            }
          }
        }
      }
    } else if (extractor && !container) {
      extractor.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_ROAD } }).onFirst(r => {
        this.room.createConstructionSite(r.pos, STRUCTURE_CONTAINER);
      });
    } else if (!extractor) {
      // create the extractor construction site
      this.room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
      if (!mem.id) mem.id = mineral.id;
    }

    this.set('mineral', mem);
  }

  mineDeposits() {
    const deposits = this.get('deposits') || {};
    let mining = this.get('mining-deposit');
    const maxCooldown = 85;

    Object.keys(deposits).forEach(depositId => {
      const depositMem = deposits[depositId];

      if (depositMem.expectedDecay < Game.time || depositMem.lastCooldown >= maxCooldown) {
        deposits[depositId] = undefined;
        if (mining === depositId) mining = null;
      } else if (depositMem && (!depositMem.lastCooldown || depositMem.lastCooldown < maxCooldown) && !depositMem.disabled && (!mining || mining === depositId)) {
        mining = depositId;

        if (Game.time % 50 === OK) {
          const deposit = Game.getObjectById(depositId);
          if (deposit) {
            depositMem.lastCooldown = deposit.lastCooldown;
            // const hostiles = deposit.pos.findInRange(FIND_HOSTILE_CREEPS, 2);
            // if (deposit.pos.findInRange(FIND_HOSTILE_CREEPS, 2).length >= 2) {
            //   depositMem.contested = Game.time;
            //   // hostiles
            //   // depositMem.disabled = true;
            //   mining = null; 
            // }
          }

          const haulers = Object.keys(this.creeps).filter(id => {
            const creep = this.creeps[id];
            if (creep.memory.job === 'hauler' && creep.memory.targetRoom === depositMem.room && creep.memory.source === depositId) {
              return creep;
            }
          });

          // spawn is stagered by 300 ticks
          const desiredHaulerCount = depositMem.lastCooldown <= 35 ? 2 : 1;
          if (haulers.length < desiredHaulerCount || (haulers.length === 1 && creepHasAged(haulers[0]))) {
            let body = m10c10;
            if (this.room.controller.level >= 7 && haulers.length === 0 && depositMem.lastCooldown <= 30) body = [...m10c10, ...m10c10];
            this.spawnController.createDrone('hauler', body, { targetRoom: depositMem.room, source: depositId });
          }

          const miner = depositMem.miner && Game.creeps[depositMem.miner] ? Game.creeps[depositMem.miner] : (() => {
            const creep = this.findCreeps(c => c.memory.job === 'miner' && c.memory.source === depositId).onFirst(c => Game.creeps[c]);
            if (creep) {
              depositMem.miner = creep.name;
              return creep;
            }
          })();

          const desiredMinerCount = depositMem.walkablePositions > 1 ? 2 : 1;
          const miners = roomSupport.getWorkers(depositMem, 'miners');
          const spawnDelta = miner && miner.memory.travelTime ? miner.memory.travelTime + 50 : 100;
          if (!miner || (miners.length < desiredMinerCount)) {
            const w3c2m4 = [WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY]; // 600
            let body = [...w10m10, ...m5c5]; // 2000

            if (this.controller.level >= 7) {
              if (depositMem.lastCooldown >= 35) {
                body = [...m5, ...w10m10, ...w10m10, WORK, WORK, WORK, WORK, CARRY];
              } else {
                body = [...w10m10, ...w10m10, CARRY, CARRY, CARRY, CARRY]; // 3200
              }
            }

            const res = this.spawnController.createDrone('miner', body, { targetRoom: depositMem.room, source: depositId });
            if (res.status === OK) {
              depositMem.miner = res.name;
              depositMem.miners.push(res.name);
            }
          }
          // if (miner && (!depositMem.miner || depositMem.miner !== miner.name)) depositMem.miner = miner.name;

          deposits[depositId] = depositMem;
        }
      }
    });

    this.set('mining-deposit', mining);
    this.set('deposits', deposits);
  }

  manageLinks() {
    let nextLinkTransfer = this.get('nextLinkTransfer') || 0;
    if (nextLinkTransfer > Game.time) {
      return;
    }

    const links = this.get('links') || {};
    const controllerLink = links.controllerLink && Game.getObjectById(links.controllerLink);

    if ((links.nextCheck || 0) <= Game.time) {
      const sourceLinks = [];
      this.room.find(FIND_SOURCES).forEach(source => {
        source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
          filter: (structure) => structure.structureType === STRUCTURE_LINK,
        }).onFirst(link => sourceLinks.push(link.id));
      });
      links.sourceLinks = sourceLinks;

      // finds the controller link
      if (!controllerLink) {
        this.controller.pos.findInRange(FIND_MY_STRUCTURES, 3, {
          filter: (structure) => structure.structureType === STRUCTURE_LINK,
        }).onFirst(link => links.controllerLink = link.id); 
      }

      // finds the spawn link
      this.storage && this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2, {
        filter: (structure) => structure.structureType === STRUCTURE_LINK,
      }).onFirst(link => links.mainLink = link.id);

      links.nextCheck = Game.time + 2269;
      this.set('links', links);
      return;
    }

    const mainLink = links.mainLink && Game.getObjectById(links.mainLink);
    let sourceLinks = links.sourceLinks && links.sourceLinks.map(id => Game.getObjectById(id));

    if (sourceLinks.length > 0) {
      this.set('nextLinkTransfer', Game.time + 29);
      sourceLinks = sourceLinks.filter((link) => {
        return link.cooldown === 0 && (link.store.getUsedCapacity(RESOURCE_ENERGY) >= 100);
      }).sort((a, b) => b.store.energy - a.store.energy);

      const fromLink = sourceLinks[0]; // the link with the most energy
      if (fromLink) {
        if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 400) {
          fromLink.transferEnergy(controllerLink);
        } else if (mainLink && mainLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          fromLink.transferEnergy(mainLink);
        }
      }
    } else {
      this.set('nextLinkTransfer', Game.time + 253);
    }
  }

  monitorStructures() {
    const structures = this.get('structures');
    // all, but wall?
    // walls
    // repairTargets

    // const walls = this.room.find(FIND_STRUCTURES, { filter: (struct) => {
    //   return struct.structureType === STRUCTURE_WALL ||  struct.structureType === STRUCTURE_RAMPART;
    // }});
    // if (!this.get('walls')) {
    //   // this.set('walls', walls.map(w => w.id))
    // };
  }

  handleRecovery() {
    if (!this.spawn.spawning) {
      const room = this.room;
      const storage = this.storage;

      const haulers = room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'hauler' } } });
      if (haulers.length <= 1 && storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
        const maxCost = room.energyCapacityAvailable < 1600 ? room.energyCapacityAvailable : 1600;
        const cost = room.energyAvailable < maxCost ? room.energyAvailable : maxCost;
        this.spawnController.spawnHauler(cost, {}, true);
      } else {
        const nearestSource = this.spawn.pos.findClosestByPath(FIND_SOURCES);
        if (nearestSource) {
          this.spawnController.createDrone('drone', [WORK,MOVE,CARRY,MOVE,CARRY], { source: nearestSource.id });
          this.set('mode', 'standard');
        }
      }
    }
  }

  handleRoomMode() {
    let mode = this.get('mode') || 'standard';
    let nextModeCheck = this.get('nextModeCheck') || 0;
    if (nextModeCheck <= Game.time) {
      const creepCount = Object.keys(this.creeps).length;
      if (mode !== 'recovery' && creepCount <= 1) {
        mode = 'recovery';
        nextModeCheck = Game.time + 256;
      } else if (creepCount >= 2) {
        nextModeCheck = Game.time + 151;
        if (mode === 'recovery') mode = 'standard';
      }

      // todo: check if there is a prolonged encounter going.

      const powerBank = this.get('powerBank');
      if (powerBank) {
        if (Memory.powerBanks[powerBank]) {
          mode = 'power';
          nextModeCheck = Game.time + 1000; 
        } else {
          this.set('powerBank', undefined);
          mode = 'standard';
        }
      } else if (mode === 'power') {
        mode = 'standard';
      }

      const siegingBanks = global.hasKeys(Memory.powerBanks);
      if (mode !== 'power' && mode !== 'recovery') {
        if (this.controller.level >= 6 && !siegingBanks && Game.cpu.bucket >= 8500) {
          const hasEnergy = this.storage.store.getUsedCapacity('energy') >= 135000;
          if (hasEnergy) {
            mode = 'reinforcing';
          } else if (mode === 'reinforcing') {
            mode = 'standard';
          }
        }

        let buildCost = 0;
        const buildTargets = this.room.find(FIND_CONSTRUCTION_SITES);
        if (buildTargets.length > 0) {
          mode = 'expanding';
          this.set('build-targets', buildTargets.map(t => {
            buildCost = buildCost + (t.progressTotal - t.progress);
            return t.id;
          }));
          this.set('build-cost', buildCost);
          nextModeCheck = Game.time + 25; // check more frequently to keep targets updated
        } else if (mode === 'expanding' && (buildTargets.length === 0 || !this.storage)) {
          mode = 'standard';
          this.set('build-targets', undefined);
          this.set('build-cost', undefined);
        }
      } else if (siegingBanks && mode === 'expanding' || mode === 'reinforcing') {
        mode = 'standard';
      }

      this.set('nextModeCheck', nextModeCheck);
      if (mode !== this.get('mode')) this.set('mode', mode);
    }

    switch (mode) {
      case 'recovery':
        return this.handleRecovery();
      case 'reinforcing':
      case 'expanding':
        if (Game.time % 250 === OK && Game.cpu.bucket >= 7500) {
          // we have build sites that need attention, spawn some builders!
          const builders = this.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'builder' } } });
          const limit = this.get('build-cost') >= 10000 ? 2 : 1;

          if (builders.length < limit && !this.spawnController.spawning) {
            let body = [WORK, WORK, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY];
            if (this.room.controller.level >= 6) body = [...body, ...body, WORK];
            const res = this.spawnController.createDrone('builder', body);
            // if (res.status === OK) {
            //   nextModeCheck = Game.time + 1500;
            // }
          }
        }
        break;
      // case 'standard':
      // default:
      //   break;
      case 'power':
        // todo: consider creating another creep to assist with power in the hive
        // if I dont have the power creep in my room that should be assisting.
        break;
    }

    return mode;
  }

  run() {
    try {
      if (!this.getSpawn() || this.room.memory.disabled) return;
      const cpu = Game.cpu.getUsed();
      this.init();

      if (this.get('toSpawn')) this.spawnController.spawnCreep();
      const controllerLevel = this.controller.level;
      // let tCpu = Game.cpu.getUsed();
      if (this.global.towers.length > 0) towerService.run(this.room, this.global.towers);
      // console.log('t-cpu', (Game.cpu.getUsed() - tCpu).toFixed(3));
      let mode = this.handleRoomMode();
      const captureFlag = Game.flags[`capture-${this.room.name}`];

      const sources = this.manageSources();
      let haveMiners = !!sources;
      if (sources) {
        for (const id in sources) {
          const sourceData = sources[id];
          if (!sourceData.miner || !Game.creeps[sourceData.miner]) {
            haveMiners = false;
            break; 
          }
        }
      }

      // energy mining operations must be underway
      if (controllerLevel >= 2 && sources) {
        const storedEnergy = this.room.storage ? this.room.storage.store.getUsedCapacity('energy') : 0;
        const capturingPower = this.room.memory.powerBank;

        if (haveMiners) {
          this.manageControllerLevel();

          // allows a room to mine a source in targetRoom
          // const canSpawn = this.spawnController.getNextSpawn() || !this.spawnController.spawning;
          const enabled = controllerLevel !== 8 || (!capturingPower && storedEnergy <= 250000);
          // do I want to stop gathering energy when I am getting full? I lose control of the room, which isn't ideal. The containers are destroyed.
          if (enabled && Game.time % 33 === OK) {
            this.manageExternalSources();
            // roomSupport.manageOutposts(this);
          }

          const haulers = roomSupport.getWorkers(this.room.memory, 'haulers');
          if (haulers.length === 0) {
            const maxCost = this.room.energyCapacityAvailable < 1350 ? this.room.energyCapacityAvailable : 1350;
            let cost = this.room.energyAvailable < maxCost ? this.room.energyAvailable : maxCost;
            if (Object.keys(sources).length <= 1) cost = 900;

            const spawnFunc = controllerLevel >= 5 ? 'spawnInternalHauler' : 'spawnHauler';
            const res = this.spawnController[spawnFunc](cost, {}, true);
            if (res && res.status === OK) {
              haulers.push(res.name);
              this.room.memory.haulers = haulers;
            }
          }

          if (captureFlag) {
            if (captureFlag.memory && !captureFlag.memory.storage) captureFlag.memory.storage = this.storage.id;
            roomSupport.captureRoom(captureFlag, this.spawnController);
          }
        }

        if (controllerLevel >= 5) {
          this.manageLinks();

          if (controllerLevel >= 6) {
            this.labController.run();

            if (this.terminalController) {
              this.terminalController.manageTerminal();

              if (storedEnergy + this.terminalController.getUsedCapacity('energy') <= 15000) {
                this.terminalController.requestEnergyInjection();
              }
            }

            const minStoredEnergy = 10000;
            const hasMinimumEnergy = storedEnergy >= minStoredEnergy;
            const bucketPlentiful = Game.cpu.bucket >= 7500;

            if (haveMiners && hasMinimumEnergy && !capturingPower && bucketPlentiful) {
              const targetDeposit = this.get('mining-deposit');
              if (targetDeposit || this.getEnergyPercentage() > 0.75 && storedEnergy >= 25000) {
                this.mineDeposits();
              }

              this.manageMineral();
            }

            if (controllerLevel >= 7) {
              if (this.factoryController) {
                this.factoryController.run();

                const job = this.factoryController.get('job');
                if (!job && hasMinimumEnergy && this.storage.store['battery'] >= 200000 && this.factory.store['energy'] <= 12000) {
                  this.factoryController.setJob('energy', 35000);
                }
              }

              if (controllerLevel >= 8) {
                const observer = observerService.getObserver(this.room);
                if (observer) observerService.run(observer);

                this.powerSpawnController.run(this.factoryController);
              }

              const room = this.get('supporting') && Game.rooms[this.get('supporting')];
              if (!captureFlag && room && storedEnergy >= 50000) {
                roomSupport.supportRoom(room, this.spawnController, this.storage.id);
              }
            }
          }
        }
      }

      // end of loop data
      // this.set('cpu', Game.cpu.getUsed() - cpu);
      return {
        energy: this.room.storage ? this.room.storage.store.getUsedCapacity('energy') : 0,
        battery: this.room.storage ? this.room.storage.store.getUsedCapacity('battery') : 0,
      }
    } catch (e) {
      throw e;
      console.log(this.nickname, e.toString());
    }
  }

  log(...messages) {
    console.log(this.room.name, messages);
  }

  report() {
    if (!this.spawn || !this.room || this.room.memory.disabled) return;
    const mem = this.room.memory;
    const energyStored = this.room.storage ? `${(this.room.storage.store.getUsedCapacity('energy') / 1000).toFixed(0)}K`.padEnd(4) : '';
    const energyRequest = (mem.terminal && mem.terminal.requests && mem.terminal.requests.energy) ? `+${(mem.terminal.requests.energy / 1000).toFixed(0)}` : '';
    const spawnEnergy = `[${this.room.energyAvailable}/${this.room.energyCapacityAvailable}]`.padEnd(13);
    const spawnEnergyPercent = `\<${(this.room.energyAvailable / this.room.energyCapacityAvailable * 100).toFixed(0)}%\>`.padEnd(6);
    const energyReport = `energy:${energyStored}${energyRequest} ${spawnEnergy} ${spawnEnergyPercent}`;
    const droneCount = `creeps:${Object.keys(this.creeps).length}`.padEnd(2);
    const modicon = MODICONS[mem.mode] ? MODICONS[mem.mode].padEnd(1) : mem.mode.slice(0, 1);
    // const spawnReport = this.spawnController.report();
    const factoryJobReport = this.factoryController ? this.factoryController.jobReport() : '';

    // const extras = mem.config && mem.config.minWall;
    console.log(`${this.room.name.padEnd(6)} ${modicon} ${energyReport} - ${droneCount} ${factoryJobReport}`);
  }
}

module.exports = Hive;
