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
  getHostileTarget: function(tower) {
    const healer = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(HEAL) > 0 });
    const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    return closestHostile;
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
  getRepairTargets: function() {
    // room.memory.upgradeContainer
    // room.memory.sources.forEach(mem => mem.container)
  },
  run: function(room, towers) {
    // let cpu = Game.cpu.getUsed();
    let mem = room.memory;
    const config = mem.config || defaultTowerConfig;

    // What makes a player hostile?
    const hostileTargets = room.find(FIND_HOSTILE_CREEPS);
    // const hostileTargets = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: 'Invader' } } });
    if (Game.time % 5 !== OK && hostileTargets.length === 0) return 0;
    else if (hostileTargets.length > 0 && Game.time % 3 === OK) console.log(`User ${hostileTargets[0].owner.username} spotted!`);
    
    let repairTargets;
    let minWallHealth = Infinity;
    if (hostileTargets.length === OK) {
      // todo: repair targets for the tower need to be handled out of memory. 
      // I can avoid checking structures that dont decay if an enemy hasn't been in the room
      // I only need to be told which wall or rampart is being sieged..
      // Scan just the roads, ramparts, containers.
      // I could potentially check roads or containers less often?
      repairTargets = room.find(FIND_STRUCTURES, { filter: (struct) => {
        const criticallyLow = ((struct.hits / struct.hitsMax) <= 0.5) && (struct.hits <= 20000);
        const minimumDamage = (struct.hitsMax - struct.hits) >= 1000; // max heal is 800
        const containers = struct.structureType === STRUCTURE_CONTAINER && struct.hits < 150000;
        const tunnels = struct.structureType === STRUCTURE_ROAD && struct.hits > 5000 && struct.hits < 500000;
        if (struct.structureType === STRUCTURE_WALL || struct.structureType === STRUCTURE_RAMPART) {
          if (struct.hits < minWallHealth) {
            minWallHealth = struct.hits;
          }
          return struct.hits < config.minWall;
        }
        // const walls = struct.structureType === STRUCTURE_WALL && struct.hits < config.minWall;
        // const ramparts = struct.structureType === STRUCTURE_RAMPART && struct.hits <= config.minWall;

        return criticallyLow || (minimumDamage && (containers || tunnels));
      }});

      if (mem.encounter && mem.encounter.lastInteraction + 50 <= Game.time) {
        if (!mem.encounterHistory) mem.encounterHistory = [];
        mem.encounterHistory.push({ ...mem.encounter, length: mem.encounter.lastInteraction - mem.encounter.startTime });
        mem.encounter = null;
      }

      if (repairTargets.length === OK) {
        if (minWallHealth >= config.minWall && minWallHealth < 12000000) {
          config.minWall = minWallHealth;
        }

        if (mem.mode === 'reinforcing') {
          // config.minWall = config.minWall + 250;
          // mem.config = config;
        } else if (config.reinforcing && room.storage.store['energy'] >= 135000) {
          config.minWall = config.minWall + 250;
          mem.config = config;
          return; // no targets
        }
      }
    } else {
      if (mem.encounter) {
        mem.encounter.lastInteraction = Game.time;
        if (hostileTargets.length > mem.enounter.count) {
          mem.enounter.count = hostileTargets.length;
        }
      } else if (hostileTargets[0].owner.username !== 'Invader') {
        // starts an ancounter when players are spotted in the room
        mem.encounter = {
          owner: hostileTargets[0].owner.username,
          count: hostileTargets.length,
          startTime: Game.time,
          lastInteraction: Game.time,
        };
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
        const target = tower.pos.findClosestByRange(repairTargets);
        if (target) tower.repair(target);
      }

      const minEnergy = hostileTargets.length > 0 ? 700 : 400;
      if (tower.store.getUsedCapacity('energy') <= minEnergy) {
        mem.tEnergy[tower.id] = tower.store.getFreeCapacity('energy');
      }
    });

    // console.log('t-cpu', Game.cpu.getUsed() - cpu);
    room.memory = mem;
  }
}

module.exports = towerService;
