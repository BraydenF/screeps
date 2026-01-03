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

const w5 = [WORK, WORK, WORK, WORK, WORK];
const m5 = [MOVE, MOVE, MOVE, MOVE, MOVE];
const m10 = [...m5, ...m5]; // 500
const c5 = [CARRY, CARRY, CARRY, CARRY, CARRY]; // 250
const a5 = [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK]; // 400
const ra5 = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK]; // 400
const a10 = [...a5, ...a5]; // 800
const ra10 = [...ra5, ...ra5];
const h5 = [HEAL, HEAL, HEAL, HEAL, HEAL]; // 1250
const h10 = [...h5, ...h5]; // 2500

const w10m5 = [...w5, ...w5, ...m5]; // cost 1250
const w10m10 = [...w5, ...w5, ...m5, ...m5]; // cost 1500
const w15m15 = [...w5, ...w5, ...w5, ...m5, ...m5, ...m5]; // cost 1800
const m2c2 = [MOVE, MOVE, CARRY, CARRY];
const m5c5 = [...m5, ...c5]; // 250 capacity
const m10c10 = [...c5, ...m5, ...c5, ...m5]; // 500 capacity

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

  get towers() {
    let towers = global[`${this.roomName}-towers`];
    if (!towers || Game.time % 100 === OK) {
      towers = this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
      global[`${this.roomName}-towers`] = towers;
      this.set('towers', towers.map(t => t.id));
    }
    return towers;
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
    this.creeps = {};
    const key = `${this.roomName}-creeps`;
    global[key] && Object.keys(global[key]).forEach(name => {
      if (Game.creeps[name]) {
        this.creeps[name] = global[key][name];
      } else {
        global[key][name] = undefined;
      }
    });

    this.spawn = SpawnController.getPrimarySpawn(this.room, this.spawns);
    // this.spawnController = new SpawnController(this);
    this.spawnController.sync(this);
    this.taskController.refresh(this);

    if (this.controller.level >= 7) {
      const factoryMem = this.room.memory.factory || {};
      this.factory = factoryMem.id ? Game.getObjectById(factoryMem.id) : this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } }).onFirst(f => f);
      if (!this.factoryController && this.factory) this.factoryController = new FactoryController(this.factory);
    }

    if (this.room.terminal) {
      if (this.terminalController) {
        this.terminalController.init(this.room.terminal);
      } else {
        this.terminalController = new TerminalController(this.room.terminal);
      }
    }
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

  // getTowers() {
  //   let towers = this.get('towers').map(id => Game.getObjectById(id));
  //   if (Game.time % 100 === OK) {
  //     towers = this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
  //     this.set('towers', towers.map(t => t.id));
  //   }
  //   return towers;
  // }

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
        upgraderNeedsReplaced = upgraders.length < 2;
      } else {
        upgraderNeedsReplaced = upgraders.length === 0 || (upgraders.length === 1 ? upgraders[0] && upgraders[0].ticksToLive <= 750 : false);
      }

      if (upgraderNeedsReplaced) {
        this.spawnController.spawnUpgrader();
      }
    }
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
    const room = this.room;
    // handles energy resource logic
    const sourcesMem = this.getSourceMem();

    if (Game.time % 25 === 0) {
      for (const sourceId in sourcesMem) {
        const source = Game.getObjectById(sourceId);
        let mem = sourcesMem[sourceId];

        let container = mem.container && Game.getObjectById(mem.container);
        if (!container) {
          source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
          }).onFirst((first) => {
            container = first;
            mem.container = first.id
          });
        }

        let link = mem.link && Game.getObjectById(mem.link);
        if (!link) {
          source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (structure) => structure.structureType === STRUCTURE_LINK,
          }).onFirst((first) => mem.link = first.id);
        }

        let nearestSpawn = mem.nearestSpawn && Game.getObjectById(mem.nearestSpawn);
        if (!nearestSpawn) {
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

        let hauler = mem.hauler && Game.creeps[mem.hauler];
        if (!hauler) hauler = this.findCreepWithSource('hauler', source.id).first();

        // creates haulers for each source, if there is energy or a miner
        if (this.controller.level <= 5) {
          if (!mem.hauler && mem.hauler) mem.hauler = null;
          else if (hauler && hauler.name !== mem.hauler) mem.hauler = hauler.name;
          if (!hauler && (miner || (!miner && container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 1000))) {
            const maxCost = this.room.energyCapacityAvailable < 1000 ? this.room.energyCapacityAvailable : 1000;
            const cost = this.room.energyAvailable < maxCost ? this.room.energyAvailable : maxCost;

            if (this.spawnController.canSpawn(cost)) {
              const res = this.spawnController.spawnHauler(cost, { source: source.id }, true);
              if (res && res.status === OK) mem.hauler = res.name;
              return;
            }
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
        }
        sourcesMem[source.id] = mem;
      }
      this.set('sources', sourcesMem);
    }

    return sourcesMem;
  }

  manageExternalSources() {
    const externalSources = this.get('externalSources') || {};

    externalSources && Object.keys(externalSources).map(roomName => {
      let { sources, level, stats, disabled } = externalSources[roomName];
      const room = Game.rooms[roomName];
      if (disabled) return;

      // 
      if (room && level && level >= 3) {
        const reservation = room && room.controller.reservation;
        const invaders = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: 'Invader' } } });
        const invaderCores = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } });

        // defend against invaders
        if (invaders.length > 0 || invaderCores.length > 0) {
          this.findCreeps(c => c && c.memory.job === 'soldier' && c.memory.targetRoom === roomName).onEmpty(() => {
            const target = invaders.length > 0 ? invaders[0].id : invaderCores[0].id;
            this.spawnController.createDrone('soldier', [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK], { targetRoom: roomName, target });
          });
        }

        // manage controller reservation
        if (!reservation || reservation.ticksToEnd < 3500) {
          this.findCreeps(c => c && c.memory.job === 'flagbearer' && c.memory.targetRoom === roomName).onEmpty(() => {
            const body = this.room.controller.level >= 7 ? [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM] : [MOVE, CLAIM];
            this.spawnController.createDrone('flagbearer', body, { targetRoom: roomName });
          });
        }
      }

      if (sources) {
        externalSources[roomName].sources = sources.map(sourceMem => {
          if (typeof sourceMem === 'string') sourceMem = { id: sourceMem };

          if (level && level >= 3) {
            let keeper = sourceMem.keeper && Game.creeps[sourceMem.keeper];
            if (!keeper) keeper = this.getCreepWithSource('keeper', sourceMem.id);
            if (!Game.creeps[sourceMem.keeper] && keeper) sourceMem.keeper = keeper.name;

            if (!keeper || keeper.ticksToLive < 25) {
              let body = [...w5, MOVE, WORK, ...m5, CARRY, CARRY, CARRY, CARRY]; // cost 1050
              this.spawnController.setNextSpawn({ job: 'keeper', body: body, memory: { targetRoom: roomName, source: sourceMem.id } });
            }

            const container = sourceMem.container ? Game.getObjectById(sourceMem.container) : (() => {
              const source = Game.getObjectById(sourceMem.id);
              const container = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
              if (container) sourceMem.container = container.id;
              return container;
            })();

            if (container) {
              const haulers = Object.keys(this.creeps).filter(id => {
                const mem = this.creeps[id] && this.creeps[id].memory;
                if (mem && mem.job === 'hauler' && mem.targetRoom === roomName && mem.source === sourceMem.id) {
                  return this.creeps[id];
                }
              });

              if (!haulers || haulers.length < 1) {
                let body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
                this.spawnController.setNextSpawn({ job: 'hauler', body, memory: { targetRoom: roomName, source: sourceMem.id, container: container.id } });
              }
            } else {
              // construct the container!
              const source = Game.getObjectById(sourceMem.id);
              if (source) {
                // todo: the room memory could be updated by the hive here to avoid the search.
                const cSite = source.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_CONTAINER } });
                if (!cSite) {
                  const ret = PathFinder.search(source.pos, this.room.storage.pos, { maxRooms: 1 });
                  room.createConstructionSite(ret.path[0], STRUCTURE_CONTAINER); // ret.path[0]
                }
              }
            }
          } else {
            let externalMiner = sourceMem.miner && Game.creeps[sourceMem.miner];
            if (!externalMiner) externalMiner = this.getCreepWithSource('miner', sourceMem.id);

            if (!Game.creeps[sourceMem.miner] && externalMiner) sourceMem.miner = externalMiner.name;
            if (!externalMiner || externalMiner.ticksToLive < 25) {
              let body = level < 2
                ? [WORK, WORK, WORK, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE] // cost 1050
                : [WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY]; // cost 750
              this.spawnController.setNextSpawn({ job: 'miner', body: body, memory: { targetRoom: roomName, source: sourceMem.id } });
            }

            // level 2 - hauler time
            if (level && level >= 2 && externalMiner) {
              const haulers = Object.keys(this.creeps).filter(id => {
                const mem = this.creeps[id] && this.creeps[id].memory;
                if (mem && mem.job === 'hauler' && mem.targetRoom === roomName && mem.source === sourceMem.id) {
                  return this.creeps[id];
                }
              });

              if (!haulers || haulers.length < 2) {
                let body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
                this.spawnController.setNextSpawn({ job: 'hauler', body, memory: { targetRoom: roomName, source: sourceMem.id } });
              }
            }
          }

          return sourceMem;
        });
      }
    });

    this.set('externalSources', externalSources);
  }

  manageMineral() {
    if (Game.time % 100 === 0 && this.controller.level >= 6) {
      const miningMineral = this.get('miningMineral');
      const mem = this.get('mineral') || {};
      const mineral = mem.id ? Game.getObjectById(mem.id) : this.room.find(FIND_MINERALS).onFirst(m => m);
      const extractor = this.getExtractor();
      const memCan = mem.container && Game.getObjectById(mem.container);
      const container = memCan ? memCan : (() => {
        const container = mineral.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
        if (container) mem.container = container.id;
        return container;
      })();

      if (extractor && container && mineral) {
        if (mineral.mineralAmount > 0 && mineral.mineralAmount <= this.storage.store.getFreeCapacity('energy')) {
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

            if ((!miner.length || miner.ticksToLive < 100) && this.spawnController.canSpawn(1250) && !spawn.spawning) {
              let body = [...w5, ...w5, MOVE, MOVE, MOVE, MOVE, MOVE]; // 1250
              if (this.spawnController.canSpawn(1800)) body = [...w5, ...w5, ...w5, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]; // 1800
              const res = global[spawn.name].createDrone('miner', body, { source: mineral.id, container: container.id });
              if (res.status === OK) {
                if (!miningMineral) this.set('miningMineral', true);
              }
            }
          }

        } else if (this.get('miningMineral') && mineral.mineralAmount === 0) {
          this.set('miningMineral', false);
        }
      } else if (extractor && !container) {
        extractor.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_ROAD } }).onFirst(r => {
          this.room.createConstructionSite(r.pos, STRUCTURE_CONTAINER);
        });
      } else if (!extractor) {
        // create the extractor construction site
        this.room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
        if (!mem.id) mem.id = mineral.id;
      } else {
        if (this.get('miningMineral')) this.set('miningMineral', false);
      }

      this.set('mineral', mem);
    }
  }

  mineDeposits() {
    const deposits = this.get('deposits') || {};
    let mining = this.get('mining-deposit');
    const maxCooldown = 75;

    Object.keys(deposits).forEach(depositId => {
      const depositMem = deposits[depositId];

      if (depositMem.expectedDecay < Game.time || depositMem.lastCooldown >= maxCooldown) {
        deposits[depositId] = undefined;
        if (mining === depositId) mining = null;
      } else if (depositMem && (!depositMem.lastCooldown || depositMem.lastCooldown < maxCooldown) && !depositMem.disabled && (!mining || mining === depositId)) {
        mining = depositId;

        if (Game.time % 50 === OK) {
          const deposit = Game.getObjectById(depositId);
          if (deposit && deposit.pos.findInRange(FIND_HOSTILE_CREEPS, 2).length >= 2) {
            depositMem.contested = true;
            depositMem.disabled = true;
            mining = null;
          }

          const haulers = Object.keys(this.creeps).filter(id => {
            const creep = this.creeps[id];
            if (creep.memory.job === 'hauler' && creep.memory.targetRoom === depositMem.room && creep.memory.source === depositId) {
              return creep;
            }
          });

          // spawn is stagered by 300 ticks
          if (haulers.length === 0 || (haulers.length === 1 && haulers[0].ticksToLive <= 1200)) {
            let body = m10c10;
            if (this.room.controller.level >= 7 && depositMem.lastCooldown <= 30) body = [...m10c10, ...m10c10];
            this.spawnController.createDrone('hauler', body, { targetRoom: depositMem.room, source: depositId });
          }

          const miner = this.findCreeps(c => c.memory.job === 'miner' && c.memory.source === depositId).onFirst(c => Game.creeps[c]);
          if (!miner || miner.ticksToLive < 50) {
            const w3c2m4 = [WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY]; // 600
            let body = [...w10m10, ...m5c5]; // 2000

            if (this.controller.level >= 7) {
              body = [...w10m10, ...w10m10, CARRY, CARRY, CARRY, CARRY]; // 3200
            }

            // const spawnKey = `${depositMem.room}-${depositId}`;
            this.spawnController.createDrone('miner', body, { targetRoom: depositMem.room, source: depositId });
          }
          // if (miner && (!depositMem.miner || depositMem.miner !== miner.name)) depositMem.miner = miner.name;


          deposits[depositId] = depositMem;
        }
      }
    });

    this.set('mining-deposit', mining);
    this.set('deposits', deposits);
  }

  capturePowerBank() {
    const mem = this.get('powerBank');
    if (mem && mem.expectedDecay <= Game.time) {
      return this.set('powerBank', undefined);
    }

    if (mem && mem.room && mem.id) {
      if (mem.hits >= 200000 && Game.time % 10 === OK) {
        const healers = this.findCreeps(
          c => c.memory.job === 'healer' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
        );
        const bankTanks = this.findCreeps(
          c => c.memory.job === 'bankTank' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
        );

        if (healers.length < 4 && healers.length < bankTanks.length) {
          const body = [...m10, ...m10, ...m5, ...h5, ...h10, ...h10];
          this.spawnController.createDrone('healer', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
        }
        // const soldierLimit = mem.walkablePositions;
        if (bankTanks.length < 2 && bankTanks.length <= healers.length) {
          const body = [...m10, ...m10, ...m5, ...a5, ...a10, ...a10];
          this.spawnController.createDrone('bankTank', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
        }

        // if (bankTanks.length >= 1 && healers.length >= 2) {
        //   const turrets = this.findCreeps(
        //     c => c.memory.job === 'turrets' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
        //   );
        //   if (turrets.length < 2) {
        //     const body = [...m10, ...m10, ...ra10, ...ra10, ...h10];
        //     this.spawnController.createDrone('turrets', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
        //   }
        // }
        mem.active = true;
      }

      // the PB is visible when the assaultis in progress
      const powerBank = Game.getObjectById(mem.id);
      if (powerBank) {
        mem.engaged = true;
        mem.hits = powerBank.hits;

        if (powerBank.hits <= 750000) {
          const haulers = this.findCreeps(
            c => c.memory.job === 'power-hauler' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
          );

          // todo power-hauler: boosting or first energy assist?
          const fullHaulerCount = Math.round(powerBank.power / 1000);
          if (haulers.length < fullHaulerCount) {
            this.spawnController.createDrone('power-hauler', [...m10c10, ...m10c10], { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
          }
          // else if () {
          //   this.spawnController.createDrone('power-hauler', [...m10c10, ...m10c10], { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
          // }
          else {
            // I think we can assume we are done here.
            return this.set('powerBank', undefined);
          }
        }
      }

      this.set('powerBank', mem);
    } 
  }

  manageLinks() {
    const links = this.get('links') || {};
    const mainLink = links.mainLink && Game.getObjectById(links.mainLink);
    const controllerLink = links.controllerLink && Game.getObjectById(links.controllerLink);
    const sourceLinks = links.sourceLinks && links.sourceLinks.map(id => Game.getObjectById(id));
    // there are more links I can add to the room. The first and most minimal usage is a buffer

    // stores links in memory to avoid finds
    if (Game.time % 1000 === 0) {
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
      
      // todo: Construction Management
      // IF (controller.level === 5)
      // - find an open space equidistant to both sources from within 1 blocks of the controller container
      // -- create the controllerLink_site at that pos
      // - find the furthestSource = the source furthest from the controller by walking distance
      // -- find the open space closest to the controllerLink within 1 range of the container
      // --- create the sourceLink_site at that pos
      // ELSE IF (controller.level === 6 && sources.length === 2)
      // - find the closestSource = the source closest to the controller by walking distance
      // -- find the open space closest to the controllerLink within 1 range of the container
      // --- create the sourceLink_site at that pos

      this.set('links', links);
    }

    if (Game.time % 5 === 0) {
      const fromLink = controllerLink && controllerLink.pos.findClosestByRange(sourceLinks, { filter: (link) => {
        return link.cooldown === 0 && (link.store.getUsedCapacity(RESOURCE_ENERGY) >= 100);
      }});

      if (fromLink) {
        if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 400) {
          fromLink.transferEnergy(controllerLink);
        } else if (mainLink && mainLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          fromLink.transferEnergy(mainLink);
        }
      }
    }
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
        }
      }
    }
  }

  handleRoomMode() {
    let mode = this.get('mode') || 'standard';
    if (Game.time % 15 === OK) {
      const creepCount = Object.keys(this.creeps).length;
      if (mode !== 'recovery' && creepCount <= 1) {
        mode = 'recovery';
        this.set('mode', 'recovery');
      } else if (creepCount >= 2 && mode === 'recovery') {
        mode = 'standard';
        this.set('mode', 'standard');
      }

      // todo: to save interactions, move to a build-plan
      let buildCost = 0;
      const buildTargets = this.room.find(FIND_CONSTRUCTION_SITES);
      if (buildTargets.length > 0) {
        mode = 'expanding';
        this.set('mode', 'expanding');
        this.set('build-targets', buildTargets.map(t => {
          buildCost = buildCost + (t.progressTotal - t.progress);
          return t.id;
        }));
        this.set('build-cost', buildCost);
      } else if (mode === 'expanding' && (buildTargets.length === 0 || !this.storage)) {
        mode = 'standard';
        this.set('mode', 'standard');
        this.set('build-targets', undefined);
        this.set('build-cost', undefined);
      }

      // storage monitoring
      if (this.room.terminal && this.storage) {
        const rrs = this.terminalController.get('requestedResources') || {};
        const spaceAvailable = this.storage.store.getFreeCapacity('energy');
        if (spaceAvailable <= 5000) {
          // low storage alert - what to do?
          if (rrs.energy <= 25000) {
            this.terminalController.setRequestedResources({ ...rrs, energy: 25000 });
          }
        }
        // else if (spaceAvailable) {
        //   if (rrs.energy <= 25000) {

        //   }
        // }
      }
    }

    switch (mode) {
      case 'recovery':
        return this.handleRecovery();
      case 'expanding':
        if (Game.time % 100 === OK) {
          // we have build sites that need attention, spawn some builders!
          const builders = this.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'builder' } } });
          const limit = this.get('build-cost') >= 10000 ? 2 : 1;

          if (builders.length < limit && !this.spawnController.spawning) {
            let body = [WORK, WORK, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY];
            if (this.room.controller.level >= 7) body = [...body, ...body, WORK];
            this.spawnController.createDrone('builder', body);
          }
        }
        break;
      // case 'standard':
      // default:
      //   break;
    }

    return mode;
  }

  run() {
    try {
      if (!this.getSpawn()) return;
      const cpu = Game.cpu.getUsed();
      this.init();

      if (this.get('toSpawn')) this.spawnController.spawnCreep();
      const controllerLevel = this.controller.level;
      if (this.towers.length > 0) towerService.run(this.room, this.towers);
      let mode = this.handleRoomMode();

      const sources = this.manageSources();
      const haveMiners = sources && Object.keys(sources).reduce((acc, id) => {
        return acc && sources[id].miner && Game.creeps[sources[id].miner]
      }, true);

      // energy mining operations must be underway
      if (controllerLevel >= 2 && sources) {
        if (haveMiners) {
          this.manageControllerLevel();

          // allows a room to mine a source in targetRoom
          // const canSpawn = this.spawnController.getNextSpawn() || !this.spawnController.spawning;
          // const enabled = controllerLevel !== 8 || (this.room.storage.store.getUsedCapacity('energy') <= 150000);
          // if (enabled && canSpawn && Game.time % 33 === OK) {
            // this.manageExternalSources();
          // }
        }

        if (controllerLevel >= 5) {
          this.manageLinks();

          if (controllerLevel >= 6) {
            this.labController.run();

            const haulers = roomSupport.getWorkers(this.room.memory, 'haulers');
            // const replaceHauler = haulers.length === 0 || (haulers.length === 1 ? haulers[0] && haulers[0].ticksToLive <= 100 : false);

            if (haulers.length === 0) {
              const maxCost = this.room.energyCapacityAvailable < 1600 ? this.room.energyCapacityAvailable : 1600;
              const cost = this.room.energyAvailable < maxCost ? this.room.energyAvailable : maxCost;
              const res = this.spawnController.spawnHauler(cost, {}, true);
              if (res && res.status === OK) {
                haulers.push(res.name);
                this.room.memory.haulers = haulers;
              }
            }

            if (this.terminalController) {
              this.terminalController.manageTerminal();

              // this can be easier, early bases could use energy injection as well. This was used to handle a colapsing lvl 8 room
              // const noRequestPending = this.terminalController.getRequestAmount('energy') === 0;
              // const lowEnergy = this.storage.store['energy'] < 10000 && this.terminalController.terminal.store['energy'] <= 5000;
              // if (noRequestPending && this.getEnergyPercentage() <= 10 && lowEnergy) {
              //   this.terminalController.createRequest('energy', 5000);
              // } else if (!noRequestPending && (!lowEnergy || this.terminalController.terminal.store['energy'] >= 5000)) {
              //   this.terminalController.createRequest('energy', 0);
              // }
            }

            const minStoredEnergy = 10000;
            const targetDeposit = this.get('mining-deposit');
            const capturingPower = this.room.memory.powerBank && this.room.memory.powerBank.active;

            if (haveMiners && this.storage.store.getUsedCapacity('energy') >= minStoredEnergy && !capturingPower) {
              if (targetDeposit || this.getEnergyPercentage() > 0.75 && this.storage.store.getUsedCapacity('energy') >= 25000) {
                this.mineDeposits();
              }

              this.manageMineral();
            }

            if (controllerLevel >= 7) {
              if (this.factoryController) {
                this.factoryController.run();

                const job = this.factoryController.get('job');
                if (!job && this.storage.store['energy'] < minStoredEnergy && this.storage.store['battery'] >= 200000 && this.factory.store['energy'] <= 12000) {
                  this.factoryController.setJob('energy', 35000);
                }
              }

              if (capturingPower || (this.getEnergyPercentage() > 0.75 && this.storage.store.getUsedCapacity('energy') >= 100000)) {
                this.capturePowerBank();
              }

              if (controllerLevel >= 8) {
                // I can stop scanning when I have something to do!
                if (this.storage.store['energy'] > minStoredEnergy) {
                  this.observe();
                }
                this.powerSpawnController.run();

                // const centralRooms = this.get('extractors');
                // const flag = Game.flags[`${this.room.name}-deposit`];
                // if (flag) roomSupport.mineCentralRoom(this.spawnController, flag);
              }

              // room support
              const room = this.get('supporting') && Game.rooms[this.get('supporting')];
              if (room && this.room.storage.store['energy'] >= 50000) {
                roomSupport.supportRoom(room, this.spawnController, this.storage.id);
              }
            }
          }
        }
      }

      // const captureFlag = Game.flags[`capture-${this.room.name}`];
      // if (captureFlag) {
      //   if (captureFlag.memory && !captureFlag.memory.storage) captureFlag.memory.storage = this.storage.id;
      //   roomSupport.captureRoom(captureFlag, this.spawnController);
      // }

      // end of loop data
      this.set('cpu', Game.cpu.getUsed() - cpu);
      return {
        energy: this.room.storage ? this.room.storage.store.getUsedCapacity('energy') : 0,
        battery: this.room.storage ? this.room.storage.store.getUsedCapacity('battery') : 0,
        // energy: this.room.storage.store.getUsedCapacity('energy'),
      }
    } catch (e) {
      throw e;
      console.log(this.nickname, e.toString());
    }
  }

  observeRoom(room) {
    const status = this.observer.observeRoom(room);
    if (status === OK) {
      this.room.memory.observableRoom = room;
    } else {
      this.room.memory.observableRoom = null;
    }
  }

  observe() {
    this.observer = observerService.getObserver(this.room);

    if (this.observer && this.config.observerRooms) {
      if (this.room.memory.observableRoom) {
        observerService.scanRoom(this.room, Game.rooms[this.room.memory.observableRoom]);
        this.room.memory.observableRoom = null;
      }

      // if (!this.observableRooms) this.observableRooms = observerService.createRoomCycler(this.config.observerRooms);
      if (Game.time % 2 === OK) {
        // const room = this.observableRooms.getRoom();
        const room = this.config.observerRooms.rand();
        this.observeRoom(room);
      }
    }
  }

  log(...messages) {
    console.log(this.room.name, messages);
  }

  report() {
    if (!this.spawn) return;
    const mem = this.room.memory;
    const energyStored = this.room.storage ? `${(this.room.storage.store.getUsedCapacity('energy') / 1000).toFixed(0)}K` : '';
    const energyRequest = (mem.terminal && mem.terminal.requests && mem.terminal.requests.energy) ? `+${(mem.terminal.requests.energy / 1000).toFixed(0)}` : '';
    const spawnEnergy = `<b>energy:</b> ${energyStored}${energyRequest} [${this.room.energyAvailable}/${this.room.energyCapacityAvailable}] <${(this.room.energyAvailable / this.room.energyCapacityAvailable * 100).toFixed(0)}%>`;
    const droneCount = `<b>creeps:</b> ${Object.keys(this.creeps).length}`;
    // const cpu = `cpu: ${this.get('cpu').toFixed(4)}`;
    const spawnReport = this.spawnController.report();
    const factoryJobReport = this.factoryController ? this.factoryController.jobReport() : '';
    console.log(`<b>${this.nickname} - ${this.room.name}</b>`, '-', spawnEnergy, '-', droneCount, factoryJobReport, spawnReport);
    // this.labController.report();
    console.log('----------------------------------------');
  }
}

module.exports = Hive;
