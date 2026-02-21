// tower management system
const spawn = Game.spawns['spawn'];
const MIN_BUCKET = 25;
const defaultTowerConfig = {
  minWall: 21500,
}

// todo: move this note to somewhere it makes a bit more sense
// someone outlines a maintenance area and some wall health minimums
// I likely need to set these types of elements up
// room_strategy : {
//   'W5S7': {
//     maintenance_area: {ax: 11, ay: 5, bx: 46, by: 30},
//     min_wall: 300000,
// },
// 'W4S7': {
//   maintenance_area: {ax: 0, ay: 0, bx: 49, by: 49},
//   min_wall: 75000,
// }

const towerService = {
  getTowers: function(spawn) {
    return spawn.room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });
  },
  findHostiles: function(room) {
    const mem = room.memory;
    const now = Game.time;

    let refreshInterval = 7;
    if (mem.encounter && now - mem.encounter.lastInteraction <= 30) {
      refreshInterval = 4;
    }

    // Decide if we need to re-scan
    const shouldRefresh = !mem.hostileCache ||
      !mem.hostileCache.tick ||
      now - mem.hostileCache.tick >= refreshInterval ||
      (mem.encounter && now - mem.encounter.lastInteraction <= 10);

    let hostileIds = [];

    if (shouldRefresh) {
      const creeps = room.find(FIND_HOSTILE_CREEPS);
      hostileIds = [];

      for (let i = 0; i < creeps.length; i++) {
        const creep = creeps[i];
        if (room.name === 'E4N51') {
          const hasPlunder = Object.keys(creep.store).length > 0;
          const smallFry = creep.body.length <= 3 || creep.hits <= 100;
          const dangerous = creep.getActiveBodyparts(ATTACK) > 0 ||
                          creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                          creep.getActiveBodyparts(HEAL) > 0;

          // temporary ceasfire
          const ignored = ['vlc6wsw0l'].includes(creep.owner.username);

          // console.log(creep.id, 'ignored', ignored);
          if ((!hasPlunder && !smallFry && !dangerous) || ignored) {
            // console.log(creep.id, 'ignored');
            continue;
          }
        }
        // console.log('hostile', creep.name);
        hostileIds.push(creep.id);
      }

      // Update cache
      mem.hostileCache = { tick: now, ids: hostileIds };

      if (hostileIds.length > 0) {
        if (mem.encounter) {
          mem.encounter.lastInteraction = now;
          if (hostileIds.length > mem.encounter.count) {
            mem.encounter.count = hostileIds.length;
          }
        } else {
          var firstCreep = Game.getObjectById(hostileIds[0]);
          if (firstCreep) {
            mem.encounter = {
              owner: firstCreep.owner.username,
              count: hostileIds.length,
              startTime: now,
              lastInteraction: now
            };
          }
        }
      }
    } else {
      hostileIds = mem.hostileCache.ids || [];
    }

    var liveHostiles = [];
    for (var j = 0; j < hostileIds.length; j++) {
      var creep = Game.getObjectById(hostileIds[j]);
      if (creep) {
        liveHostiles.push(creep);
      }
    }

    return liveHostiles;
  },
  findRepairTargets: function(room, config) {
    let minWallHealth = Infinity;
    const repairTargets = room.find(FIND_STRUCTURES, { filter: (struct) => {
      const criticallyLow = ((struct.hits / struct.hitsMax) <= 0.5) && (struct.hits <= 20000);
      const minimumDamage = (struct.hitsMax - struct.hits) >= 1000;
      if (criticallyLow) return criticallyLow;
      if (!minimumDamage) return false;

      switch(struct.structureType) {
        case STRUCTURE_CONTAINER:
          return struct.hits < 150000;
        case STRUCTURE_ROAD:
          return struct.hits > 5000 && struct.hits < 500000;
        case STRUCTURE_WALL:
        case STRUCTURE_RAMPART:
          if (struct.hits < minWallHealth) {
            minWallHealth = struct.hits;
          }
          return struct.hits < config.minWall;
      }
    }}).sort((a, b) => a.hits - b.hits);

    if (minWallHealth >= config.minWall && minWallHealth < 12000000) {
      config.minWall = minWallHealth;
    }

    return repairTargets;
  },
  getEnergyStatus: function(tower) {
    let status;
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) <= 200) {
      status = 'low-energy';
    } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= 800) {
      status = 'energized';
    } else if (tower.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      status = 'full-energy';
    }
    return status
  },
  manageHauler: function(hive, tower) {
    const towerHauler = hive.get(`towerHauler-${tower.id}`);
    const towerStatus = towerService.getEnergyStatus(tower);

    // conscripts a hauler to load the tower
    if (!towerHauler) {
      const hasLowEnergy = towerService.getEnergyStatus(tower) === 'low-energy';
      if (towerStatus === 'low-energy' && hive.getEnergyStatus() !== 'low-energy') {
        const hauler = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.job === 'hauler' && creep.memory.task === 'unload' && !creep.memory.target
        });

        if (hauler) {
          hauler.memory.target = tower.id;
          hive.set(`towerHauler-${tower.id}`, hauler.id);
          console.log(`tower-${tower.id} enlisted ${hauler.name} for duty!`);
        }
      }
    } else {
      // check to see if the hauler should be released from conscription
      const hauler = Game.getObjectById(towerHauler);

      if (hauler && hauler.memory.task !== 'unload') {
        hive.set(`towerHauler-${tower.id}`, null);
        console.log(`${hauler.name} released`);
      }
    }

    return towerHauler;
  },
  run: function(room, towers) {
    let mem = room.memory;
    const config = mem.config || defaultTowerConfig;

    const hostileTargets = towerService.findHostiles(room);
    if (hostileTargets.length > 0 && Game.time % 3 === OK) console.log(`User ${hostileTargets[0].owner.username} spotted!`);

    let repairTargets = [];
    let minWallHealth = Infinity;
    if (hostileTargets.length === 0) {
      // manages encounter data
      if (mem.encounter && mem.encounter.lastInteraction + 50 <= Game.time) {
        if (mem.encounter.owner !== 'Invader') {
          if (!mem.encounterHistory) mem.encounterHistory = [];
          else if (mem.encounterHistory.length > 25) mem.encounterHistory = mem.encounterHistory.slice(0, 20);
          mem.encounterHistory.push({ ...mem.encounter, length: mem.encounter.lastInteraction - mem.encounter.startTime });
        }
        mem.encounter = null;
      }

      if ((mem.nextRepairScan || 0) <= Game.time) {
        repairTargets = towerService.findRepairTargets(room, config);

        if (repairTargets.length === OK) {
          mem.nextRepairScan = Game.time + 23;

          if (mem.mode === 'reinforcing') {
            // config.minWall = config.minWall + 250;
            // mem.config = config;
          } else if (config.reinforcing && room.storage.store['energy'] >= 135000) {
            config.minWall = config.minWall + 250;
            mem.config = config;
          }
          return;
        }
      }

    }

    const totalEnergyCapacity = towers.length * 1000;
    let totalEnergy = 0;
    mem.tEnergy = {};

    towers.forEach((tower) => {
      totalEnergy = totalEnergy + tower.store['energy'];
      if (hostileTargets.length > 0) {
        // if (damagedCreep) {
        //   tower.heal(damagedCreep);
        // } else {
        const status = tower.attack(hostileTargets[0]);
      } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= 200 && repairTargets.length > 0) {
        const target = tower.pos.findClosestByRange(repairTargets.slice(0, 3));
        if (target) tower.repair(target);
      }

      const minEnergy = hostileTargets.length > 0 ? 700 : 400;
      if (tower.store.getUsedCapacity('energy') <= minEnergy) {
        mem.tEnergy[tower.id] = tower.store.getFreeCapacity('energy');
      }
    });

    room.memory = mem;
  }
}

module.exports = towerService;
