const config = require('config');
const droneService = require('drone.service');
const towerService = require('tower.service');

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

  static getResourceContainer(spawn, minAmount = 50) {
    let container;
    spawn.room.find(FIND_SOURCES).forEach(source => {
      const mem = spawn.room.memory.sources[source.id];
      const temp = mem.container && Game.getObjectById(mem.container);
      if (temp && temp.store.getUsedCapacity(RESOURCE_ENERGY) > minAmount) {
        container = temp;
      }
    });
    return container;
  }

  get config() {
    return config.rooms[this.room.name] || {};
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
    const memory = Memory.rooms[roomName] || {};

    this.roomName = roomName;
    this.room = Game.rooms[roomName];
    this.spawns = this.room.find(FIND_MY_SPAWNS);
    this.spawn = new SpawnController(this.room, this.spawns);
    this.taskController = new TaskController(this.room);
    this.labController = new LabController(this.room);
    this.powerSpawnController = new PowerSpawnController(this.spawn);

    if (!this.spawn.name) return; // ends initilization early

    // initialize the global object for using Hives from the terminal
    this.nickname = this.room.memory.nickname || this.spawn.getSpawn().name;
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

    if (this.controller.level >= 7) {
      if (!this.factory) {
        const factoryMem = this.room.memory.factory || {};
        this.factory = factoryMem.id ? Game.getObjectById(factoryMem.id) : this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } }).onFirst(f => f);
      }
      if (!this.factoryController && this.factory) this.factoryController = new FactoryController(this.factory);
    }

    if (this.room.terminal && !this.terminalController) {
      this.terminalController = new TerminalController(this.room.terminal);
      // global[this.nickname].terminal = this.terminalController;
    }
  }

  get(key) {
    return this.room.memory[key];
  }

  set(key, value) {
    this.room.memory[key] = value;
  }

  getRoom() {
    return this.room;
  }

  getSpawn(pos = null) {
    // todo: update to use the controller to get the desired spawn.
    return this.spawn.getSpawn();
  }

  // getSources() {
  //   const sourcesMem = this.get('sources') || {};
  //   return this.room.find(FIND_SOURCES).map(s => {
  //     s.memory = sourcesMem[s.id];
  //     return s
  //   });
  // }

  getTowers() {
    let towers = this.get('towers').map(id => Game.getObjectById(id));
    if (Game.time % 100 === OK) {
      towers = this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
      this.set('towers', towers.map(t => t.id));
    }
    return towers;
  }

  getExtractor() {
    let extractor = this.get('extractor') && Game.getObjectById(this.get('extractor'));
    if (!extractor) {
      extractor = this.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR }}).onFirst(s => s);
      if (extractor) this.set('extractor', extractor.id);
    }

    return extractor;
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
    const upgraders = this.getRoom().find(FIND_MY_CREEPS, { filter: { memory: { job: 'upgrader' } } });
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
        this.spawn.spawnUpgrader();
      }
    }
  }

  getSourceMem() {
    let sourceMem = this.get('sources');
    if (!sourceMem) {
      sourceMem = this.getRoom().find(FIND_SOURCES).reduce((acc, s) => acc[s.id] = {}, {});
    }
    return sourceMem
  }

  manageSources() {
    // handles energy resource logic
    const sourcesMem = this.getSourceMem();
    const room = this.getRoom();

    if (Game.time % 25 === 0) {

      if (this.controller.level >= 6) {
        const haulers = room.find(FIND_MY_CREEPS, { filter: (creep) => creep.memory.job === 'hauler' });
        const replaceHauler = haulers.length === 0 || (haulers.length === 1 ? haulers[0] && haulers[0].ticksToLive <= 100 : false);
        // console.log('haulers', haulers, replaceHauler);
        if (!this.spawn.spawning && replaceHauler) {
          const maxCost = this.room.energyCapacityAvailable < 1600 ? this.room.energyCapacityAvailable : 1600;
          const cost = this.room.energyAvailable < maxCost ? this.room.energyAvailable : maxCost;
          this.spawn.spawnHauler(cost, {}, true);
        }
      }

      for (const sourceId in sourcesMem) {
        const source = Game.getObjectById(sourceId);
        let mem = sourcesMem[sourceId];
        // console.log('source', source, mem);

        let container = mem.container && Game.getObjectById(mem.container);
        if (!container) {
          // finds nearby mining containers
          source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER,
          }).onFirst((first) => {
            container = first;
            mem.container = first.id
          });
        }

        let link = mem.link && Game.getObjectById(mem.link);
        if (!link) {
          // finds nearby link
          source.pos.findInRange(FIND_STRUCTURES, 2, {
            filter: (structure) => structure.structureType === STRUCTURE_LINK,
          }).onFirst((first) => mem.link = first.id);
        }

        const miner = (mem.miner && Game.creeps[mem.miner]) || this.getCreepWithSource('miner', source.id);
        const hauler = (mem.hauler && Game.creeps[mem.hauler]) || this.getCreepWithSource('hauler', source.id);

        // creates haulers for each source, if there is energy or a miner
        if (this.controller.level <= 5) {
          if (!mem.hauler && mem.hauler) mem.hauler = null;
          else if (hauler && hauler.name !== mem.hauler) mem.hauler = hauler.name;
          if (!hauler && (miner || (!miner && container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 1000))) {
            const maxCost = this.room.energyCapacityAvailable < 1000 ? this.room.energyCapacityAvailable : 1000;
            const cost = this.room.energyAvailable < maxCost ? this.room.energyAvailable : maxCost;
            // if there is only one source, there is a greater risk of not having energy
            // console.log(this.room.name, 'hauler spawn', cost);

            if (this.spawn.canSpawn(cost)) {
              const res = this.spawn.spawnHauler(cost, { source: source.id }, true);
              if (res && res.status === OK) mem.hauler = res.name;
              return;
            }
          }
        }

        if (!miner && mem.miner) mem.miner = null;
        else if (miner && miner.name !== mem.miner) mem.miner = miner.name;
        if (!miner || (miner && miner.ticksToLive < 100)) {
          const minerCost = mem.link && this.room.energyCapacityAvailable >= 1200 ? 1200 : 550;

          if (this.spawn.canSpawn(minerCost)) {
            let body = [...w5, MOVE];
            if (this.controller.level >= 5 && minerCost >= 1200) {
              body = [...w5, WORK, WORK, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY];
            }

            const res = this.spawn.createDrone('miner', body, { source: source.id });
            if (res.status === OK) mem.miner = res.name;
          }
        }

        // sourcesMem[source.id] = mem;
      }
      // this.set('sources', sourcesMem);
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
            this.spawn.createDrone('soldier', [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK], { targetRoom: roomName, target });
          });
        }

        // manage controller reservation
        if (!reservation || reservation.ticksToEnd < 3500) {
          this.findCreeps(c => c && c.memory.job === 'flagbearer' && c.memory.targetRoom === roomName).onEmpty(() => {
            const body = this.room.controller.level >= 7 ? [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM] : [MOVE, CLAIM];
            this.spawn.createDrone('flagbearer', body, { targetRoom: roomName });
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
              this.spawn.setNextSpawn({ job: 'keeper', body: body, memory: { targetRoom: roomName, source: sourceMem.id } });
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
                this.spawn.setNextSpawn({ job: 'hauler', body, memory: { targetRoom: roomName, source: sourceMem.id, container: container.id } });
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
              this.spawn.setNextSpawn({ job: 'miner', body: body, memory: { targetRoom: roomName, source: sourceMem.id } });
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
                this.spawn.setNextSpawn({ job: 'hauler', body, memory: { targetRoom: roomName, source: sourceMem.id } });
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
      const mem = this.get('mineral') || {};
      const mineral = mem.id ? Game.getObjectById(mem.id) : this.room.find(FIND_MINERALS).onFirst(m => m);
      const extractor = this.getExtractor();
      const container = mem.container ? Game.getObjectById(mem.container) : (() => {
          const container = mineral.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
          if (container) mem.container = container.id;
          return container;
        })();

      if (extractor && container && mineral) {
        if (mineral.mineralAmount > 0 && mineral.mineralAmount <= this.storage.store.getFreeCapacity('energy')) {
          const memMiner = this.get('mineralMiner') && Game.getObjectById(this.get('mineralMiner'));
          const miner = memMiner || this.getRoom().find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.job === 'miner' && creep.memory.source === mineral.id,
          });

          if ((!miner.length || miner.ticksToLive < 100) && this.spawn.canSpawn(1250) && !this.spawn.getNextSpawn()) {
            let body = [...w5, ...w5, MOVE, MOVE, MOVE, MOVE, MOVE]; // 1250
            if (this.spawn.canSpawn(1800)) body = [...w5, ...w5, ...w5, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]; // 1800
            this.spawn.setNextSpawn({ job: 'miner', body, memory: { source: mineral.id, container: container.id } });
            this.set('miningMineral', true);
          }
        } else if (this.get('miningMineral') && mineral.mineralAmount === 0) {
          this.set('miningMineral', false);
        }
      } else if (extractor && !container) {
        extractor.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_ROAD } }).onFirst(r => {
          this.getRoom().createConstructionSite(r.pos, STRUCTURE_CONTAINER);
        });
      } else if (!extractor) {
        // create the extractor construction site
        this.getRoom().createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
        if (!mem.id) mem.id = mineral.id;
      } else {
        this.set('miningMineral', false);
      }

      this.set('mineral', mem);
    }
  }

  mineDeposits() {
    const deposits = this.get('deposits') || {};
    let mining = this.get('mining-deposit');

    Object.keys(deposits).forEach(depositId => {
      const depositMem = deposits[depositId];

      if (depositMem.expectedDecay < Game.time || depositMem.lastCooldown >= 80) {
        deposits[depositId] = undefined;
        if (mining === depositId) mining = null;
      } else if (depositMem && (!depositMem.lastCooldown || depositMem.lastCooldown < 80) && !depositMem.disabled && (!mining || mining === depositId)) {
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
            this.spawn.createDrone('hauler', body, { targetRoom: depositMem.room, source: depositId });
          }

          const miner = this.findCreeps(c => c.memory.job === 'miner' && c.memory.source === depositId).onFirst(c => Game.creeps[c]);
          if (!miner || miner.ticksToLive < 50) {
            const w3c2m4 = [WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY]; // 600
            let body = [...w10m10, ...m5c5]; // 2000

            if (this.controller.level >= 7) {
              body = [...w10m10, ...w10m10, CARRY, CARRY, CARRY, CARRY]; // 3200
            }

            // const spawnKey = `${depositMem.room}-${depositId}`;
            this.spawn.createDrone('miner', body, { targetRoom: depositMem.room, source: depositId });
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

    if (mem && mem.room && mem.id && mem.expectedDecay > Game.time) {
      // console.log(this.room.name, '->', mem.room, mem.expectedDecay - Game.time);

      if (mem.hits >= 100000 && Game.time % 10 === OK) {
        const soldiers = this.findCreeps(
          c => c.memory.job === 'soldier' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
        );
        const ranger = this.findCreeps(
          c => c.memory.job === 'ranger' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
        );
        const healers = this.findCreeps(
          c => c.memory.job === 'healer' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
        );

        if (soldiers.length < 2 && soldiers.length <= healers.length) {
          const body = [...m10, ...m10, ...a10, ...a10];
          this.spawn.createDrone('soldier', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
        }
        if (healers.length < 3 && healers.length < soldiers.length + ranger.length) {
          const body = [...m10, ...m10, ...h10, ...h10, ...m5, ...h5];
          this.spawn.createDrone('healer', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
        }
        if (ranger.length < 2) {
          const body = [...m10, ...m10, ...ra10, ...ra10];
          this.spawn.createDrone('ranger', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
        }
        mem.active = true;
      }

      // the PB is visible when the assaultis in progress
      const powerBank = Game.getObjectById(mem.id);
      if (powerBank) {
        mem.engaged = true;
        mem.hits = powerBank.hits;

        if (powerBank.hits <= 350000) {
          const haulers = this.findCreeps(
            c => c.memory.job === 'hauler' && c.memory.targetRoom === mem.room && c.memory.target === mem.id,
          );

          if (haulers.length < Math.round(powerBank.power / 1000)) {
            mem.haulers = haulers.length;
            this.spawn.createDrone('hauler', [...m10c10, ...m10c10], { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
          }
        }
      }

      this.set('powerBank', mem);
    } else if (mem && mem.expectedDecay < Game.time) {
      this.set('powerBank', undefined);
    }
  }

  mineCentralRoom() {
    const mem = this.get('extractors') || {};
    if (Game.time % 3 !== OK) return;

    Object.keys(mem).forEach(id => {
      const targetRoom = mem[id];
      const room = Game.rooms[targetRoom];

      const healer = this.findCreeps(
        c => c.memory.job === 'hguard' && c.memory.targetRoom === targetRoom && c.memory.source === id,
      ).onFirst(c => c);
      if (!healer) {
        const body = [...m10, ...h10];
        this.spawn.createDrone('hguard', body, { targetRoom, source: id });
      }

      const ranger = this.findCreeps(
        c => c.memory.job === 'ranger' && c.memory.targetRoom === targetRoom && c.memory.source === id,
      ).onFirst(c => c);
      if (!ranger) {
        const body = [...m10, ...ra10];
        this.spawn.createDrone('ranger', body, { targetRoom, source: id });
      }
      
      if (room) {
        const mineral = Game.getObjectById(id);
        const keepers = mineral && mineral.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
        if (keepers.length === OK && mineral) {
          const miner = this.findCreeps(
            c => c.memory.job === 'miner' && c.memory.targetRoom === targetRoom && c.memory.source === id,
          ).onFirst(c => c);
          if (!miner) {
            this.spawn.createDrone('miner', [...m10, ...w5, ...w5], { targetRoom, source: id });
          }

          const haulers = this.findCreeps(
            c => c.memory.job === 'hauler' && c.memory.targetRoom === targetRoom && c.memory.source === id,
          );
          if (haulers.length < 2) {
            this.spawn.createDrone('hauler', [...m10, ...c5, ...c5], { targetRoom, source: id });
          }
        }
      }
    });
  }

  manageLinks() {
    const links = this.get('links') || {};
    const mainLink = links.mainLink && Game.getObjectById(links.mainLink);
    const controllerLink = links.controllerLink && Game.getObjectById(links.controllerLink);
    const sourceLinks = links.sourceLinks && links.sourceLinks.map(id => Game.getObjectById(id));

    // stores links in memory to avoid finds
    if (Game.time % 1000 === 0) {
      const sourceLinks = [];
      this.getRoom().find(FIND_SOURCES).forEach(source => {
        source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
          filter: (structure) => structure.structureType === STRUCTURE_LINK,
        }).onFirst(link => sourceLinks.push(link.id));
      });
      links.sourceLinks = sourceLinks;

      // finds the controller link
      if (!controllerLink) {
        this.controller().pos.findInRange(FIND_MY_STRUCTURES, 3, {
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

  captureRoom(flag) {
    // todo: reserve the room
    if (typeof flag.memory !== 'object') flag.memory = { flagbearer: null, drone: null };

    if (flag.room && flag.room.controller.my) {
      // build spawn
      const spawnSite = flag.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, { filter: (site) => site.structureType === STRUCTURE_SPAWN });
      if (!spawnSite) {
        flag.room.createConstructionSite(flag.pos, STRUCTURE_SPAWN, flag.memory.spawnName);
      }

      const drone = Game.creeps[flag.memory.drone];
      // assign a drone to assist

      // todo: create a miner for each source
      // this.spawn.createDrone('miner', [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK], {targetRoom:'E14N48', source:'5bbcadb99099fc012e637b4f'});

      // todo: send a few drones to the room

      // if (drone) {
      //   if (drone.memory.task === 'recharge') {
      //     flag.memory.drone = null;
      //     drone.memory.flag = undefined;
      //   }
      //   // do I need to do anything if I have a drone?
      //   // probably just ensure that the drone can keep working, or unassign when it needs to reharge
      // } else {
      //   const creep = this.room.find(FIND_MY_CREEPS, {
      //     filter: (creep) => creep.ticksToLive >= 1250 && creep.memory.job === 'drone' && creep.memory.task === 'standby',
      //   }).onFirst(c => c);
      //   if (creep) {
      //     creep.memory.flag = `capture-${this.getSpawn().name}`;
      //     creep.memory.task = 'flag';
      //   }
      // }
    } else {
      // the room isn't claimed; spawn the flagbearer and assign to the flag
      const flagbearer = this.findCreeps(c => c.memory.job === 'flagbearer' && c.memory.flag === flag.name).onFirst(c => c);

      if (!flagbearer && !this.spawn.spawning) {
        const status = this.spawn.createDrone('flagbearer', [CLAIM,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], { flag: flag.name, targetRoom: null });
        if (status === OK) flag.memory.flagbearer = creep.name;
      }
    }

    // delete flag
  }

  handleRecovery() {
    if (!this.spawn.spawning) {
      const storage = this.storage;

      if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
        const maxCost = this.room.energyCapacityAvailable < 1600 ? this.room.energyCapacityAvailable : 1600;
        const cost = this.room.energyAvailable < maxCost ? this.room.energyAvailable : maxCost;
        this.spawn.spawnHauler(cost, {}, true);
        // this.spawn.createDrone('hauler', [MOVE,CARRY,MOVE,CARRY,MOVE,CARRY]);
      } else {
        const nearestSource = this.getSpawn().pos.findClosestByPath(FIND_SOURCES);
        this.spawn.createDrone('drone', [WORK,MOVE,CARRY,MOVE,CARRY], { source: nearestSource.id });
      }
    }
  }

  handleRoomMode() {
    let mode = this.get('mode') || 'standard';
    if (Game.time % 15 === OK) {
      const creepCount = Object.keys(this.creeps).length;
      if (creepCount < 1) {
        mode = 'recovery';
        this.set('mode', 'recovery');
      } else if (creepCount > 0 && mode === 'recovery') {
        mode = 'standard';
        this.set('mode', 'standard');
      }

      const buildTargets = this.room.find(FIND_CONSTRUCTION_SITES);
      if (mode === 'standard' && buildTargets.length > 0) {
        mode = 'expanding';
        this.set('mode', 'expanding');
        this.set('build-targets', buildTargets.map(t => t.id));
      } else if (mode === 'expanding' && (buildTargets.length === 0 || !this.storage)) {
        mode = 'standard';
        this.set('mode', 'standard');
        this.set('build-targets', undefined);
      }

      // storage monitoring
      if (this.room.terminal && this.storage) {
        const rrs = this.terminalController.get('requestedResources');
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

    // if (mode !== 'standard') console.log(mode);
    switch (mode) {
      case 'recovery':
        return this.handleRecovery();
      case 'expanding':
        if (Game.time % 100 === OK) {
          // we have build sites that need attention, spawn some builders!
          const builders = this.getRoom().find(FIND_MY_CREEPS, { filter: { memory: { job: 'builder' } } });
          if (builders.length < 2 && !this.spawn.spawning) {
            this.spawn.createDrone('builder', [WORK, WORK, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY]);
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

      if (this.get('toSpawn')) this.spawn.spawnCreep();
      const controllerLevel = this.controller.level;

      // let tcpu = Game.cpu.getUsed();
      if (this.towers.length > 0) towerService.run(this.room, this.towers);
      // console.log('tower-cpu', Game.cpu.getUsed() - tcpu, towerEnergy);

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
          const canSpawn = this.spawn.getNextSpawn() || !this.spawn.spawning;
          const enabled = controllerLevel !== 8 || (this.room.storage.store.getUsedCapacity('energy') <= 150000);
          // if (enabled && canSpawn && Game.time % 33 === OK) {
            // this.manageExternalSources();
          // }
        }

        if (controllerLevel >= 5) {
          this.manageLinks();

          if (controllerLevel >= 6) {
            // let lcpu = Game.cpu.getUsed();
            this.labController.run();
            // console.log(this.room.name, 'lab-cpu', Game.cpu.getUsed() - lcpu);

            if (this.terminalController) {
              this.terminalController.manageTerminal();

              // this can be easier, early bases could use energy injection as well. This was used to handle a colapsing lvl 8 room
              const noRequestPending = this.terminalController.getRequestAmount('energy') === 0;
              const lowEnergy = this.storage.store['energy'] < 10000 && this.terminalController.terminal.store['energy'] <= 5000;
              if (noRequestPending && this.getEnergyPercentage() <= 10 && lowEnergy) {
                // console.log('low energy alert', this.room.name);
                this.terminalController.createRequest('energy', 5000);
              } else if (!noRequestPending && (!lowEnergy || this.terminalController.terminal.store['energy'] >= 5000)) {
                this.terminalController.createRequest('energy', 0);
              }
            }

            const minStoredEnergy = 10000;
            const targetDeposit = this.get('mining-deposit');
            // console.log(this.room.name, 'targetDeposit', targetDeposit ? Game.getObjectById(targetDeposit) : null);

            // note: should I have a CPU check or something?
            if (mode === 'standard' && haveMiners && this.storage.store.getUsedCapacity('energy') >= minStoredEnergy) {
            // let time = Game.cpu.getUsed();
              // Should I limit it to a single deposit at a time?
              if (targetDeposit || this.getEnergyPercentage() > 0.75 && this.storage.store.getUsedCapacity('energy') >= 25000) {
                this.mineDeposits();
              }

              this.manageMineral();
            }

            // takes over spawning from the manageResources
            // if (Game.time % 250 === OK) {
            //   const drones = this.getRoom().find(FIND_MY_CREEPS, { filter: { memory: { job: 'drone' } } });
            //   if (drones.length === OK) {
            //     const body = [WORK, WORK, WORK, WORK, WORK, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
            //     this.spawn.createDrone('drone', body);
            //   }
            // }

            if (controllerLevel >= 7) {
              if (this.factoryController) {
                this.factoryController.run();

                const job = this.factoryController.get('job');
                if (!job && this.storage.store['energy'] < minStoredEnergy && this.storage.store['battery'] >= 250000 && this.factory.store['energy'] <= 12000) {
                  this.factoryController.setJob('energy', 35000);
                }
              }

              // todo: make power banks a higher priority than a deposit and prevent deposit spawning when engaged for CPU purposes
              const capturingPower = this.room.memory.powerBank && this.room.memory.powerBank.active;
              // if (capturingPower || (!targetDeposit && (this.getEnergyPercentage() > 0.75 && this.storage.store.getUsedCapacity('energy') >= 100000)) {
              //   this.capturePowerBank();
              // }

              if (controllerLevel >= 8) {
                // I can stop scanning when I have something to do!
                const lfw = !targetDeposit && !capturingPower;
                if (lfw && !this.storage.store['energy'] > minStoredEnergy) this.observe();
                this.powerSpawnController.run();
                // this.mineCentralRoom();
              }
            }
          }
        }
      }

      // try {
      //   if (Game.time % 2 === OK) this.taskController.generateTasks();
      // } catch (e) { Game.market.deal('68730646af4edf00121e250a', 2200, 'W7N52')
      //   // throw e;
      //   console.log('taskController', e.toString());
      // }

      // const captureFlag = Game.flags[`capture-${this.room.name}`];
      // if (captureFlag) this.captureRoom(captureFlag);

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

  observe() {
    const mem = this.get('observer') || {};
    const observer = mem.id ? Game.getObjectById(mem.id) : (() => {
      const observer = this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_OBSERVER } });
      if (observer[0]) mem.id = observer[0].id;
      return observer[0];
    })();

    if (observer && mem.observable) {
      const observableRoom = Game.rooms[mem.observable];

      if (observableRoom) {
        observableRoom.find(FIND_DEPOSITS).forEach(deposit => {
          if (deposit.lastCooldown < 100) {
            if (!this.room.memory.deposits) this.room.memory.deposits = {};
            this.room.memory.deposits[deposit.id] = {
              ...this.room.memory.deposits[deposit.id],
              id: deposit.id,
              depositType: deposit.depositType,
              lastCooldown: deposit.lastCooldown,
              expectedDecay: Game.time + deposit.ticksToDecay,
              room: mem.observable,
            }
          }
        });

        const hostileStructs = observableRoom.find(FIND_HOSTILE_STRUCTURES);
        hostileStructs.forEach(hostileStruct => {
          if (hostileStruct.structureType === STRUCTURE_POWER_BANK) {
            if (!this.room.memory.powerBank && hostileStruct.power >= 1000 && hostileStruct.ticksToDecay > 1000) {
              this.room.memory.powerBank = {
                id: hostileStruct.id,
                hits: hostileStruct.hits,
                power: hostileStruct.power,
                expectedDecay: Game.time + hostileStruct.ticksToDecay,
                room: mem.observable,
              }
            }
          }
        });

        if (hostileStructs.length === 0 && this.room.memory.powerBank && this.room.memory.powerBank === observableRoom) {
          this.room.memory.powerBank = undefined;
        }
      }
    }

    if (Game.time % 2 === OK && observer && Array.isArray(this.config.observerRooms)) {
      const room = this.config.observerRooms.rand();
      if (observer.observeRoom(room) === OK) {
        mem.observable = room;
      } else {
        mem.observable = null;
      }
    }

    this.set('observer', mem);
  }

  log(...messages) {
    console.log(this.room.name, messages);
  }

  report() {
    const energyStored = this.room.storage ? `${(this.room.storage.store.getUsedCapacity('energy') / 1000).toFixed(0)}K` : '';
    const energyRequest = this.room.memory.terminal && this.room.memory.terminal.requests.energy ? `+${(this.room.memory.terminal.requests.energy / 1000).toFixed(0)}` : '';
    // const powerIndicator = this.room.storage
    const spawnEnergy = `<b>energy:</b> ${energyStored}${energyRequest} [${this.room.energyAvailable}/${this.room.energyCapacityAvailable}] <${(this.room.energyAvailable / this.room.energyCapacityAvailable * 100).toFixed(0)}%>`;
    const droneCount = `<b>creeps:</b> ${Object.keys(this.creeps).length}`;
    // const cpu = `cpu: ${this.get('cpu').toFixed(4)}`;
    const spawnReport = this.spawn.spawning ? ` - ${this.spawn.spawning.name}[${this.spawn.spawning.remainingTime}/${this.spawn.spawning.needTime}]` : '';
    const factoryJobReport = this.factoryController ? this.factoryController.jobReport() : '';
    console.log(`<b>${this.nickname} - ${this.room.name}</b>`, '-', spawnEnergy, '-', droneCount, factoryJobReport, spawnReport);
    // if (this.spawn.spawning) {
    //   console.log(`${this.spawn.spawning.name} - ${this.spawn.spawning.remainingTime}/${this.spawn.spawning.needTime}`);
    // }
    // if (this.room.memory.toSpawn) console.log(`Spawning ${this.room.memory.toSpawn.job}`);
    // this.labController.report();
    // if (this.factoryController) this.factoryController.report();
    console.log('----------------------------------------');
  }
}

module.exports = Hive;
