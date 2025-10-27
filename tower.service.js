// tower management system
const spawn = Game.spawns['spawn'];
const MIN_BUCKET = 25;
const defaultTowerConfig = {
  min_wall: 21500,
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
// 

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
  run: function(room, towers) {
    // let cpu = Game.cpu.getUsed();
    const hostileTargets = room.find(FIND_HOSTILE_CREEPS);
    if (Game.time % 5 !== OK && hostileTargets.length === 0) return 0;
    else if (hostileTargets.length > 0 && Game.time % 3 === OK) console.log(`User ${hostileTargets[0].owner.username} spotted!`);

    const repairMultiplier = 1 * room.controller.level * 0.5;
    let repairTargets;
    if (hostileTargets.length === OK) {
      repairTargets = room.find(FIND_STRUCTURES, { filter: (struct) => {
        const criticallyLow = ((struct.hits / struct.hitsMax) <= 0.5) && (struct.hits <= 20000);
        const minimumDamage = (struct.hitsMax - struct.hits) >= 1000; // max heal is 800
        const containers = struct.structureType === STRUCTURE_CONTAINER && struct.hits < 150000;
        const walls = struct.structureType === STRUCTURE_WALL && struct.hits < (defaultTowerConfig.min_wall * repairMultiplier);
        const ramparts = struct.structureType === STRUCTURE_RAMPART && struct.hits <= defaultTowerConfig.min_wall * repairMultiplier;
        const tunnels = struct.structureType === STRUCTURE_ROAD && struct.hits > 5000 && struct.hits < 500000;

        return criticallyLow || (minimumDamage && (containers || walls || ramparts || tunnels));
      }});
    }

    if (hostileTargets.length === OK && repairTargets.length === OK) return; // no targets

    // let towerEnergy = 0;
    // room.memory.tEnergy = {};
    towers.forEach((tower) => {
      if (hostileTargets.length > 0) {
        // if (damagedCreep) {
        //   tower.heal(damagedCreep);
        // } else {
          const status = tower.attack(hostileTargets[0]);
        // }
      } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= 200 && repairTargets.length > 0) {
        const target = tower.pos.findClosestByRange(repairTargets)
        if (target) tower.repair(target);
      }

      // towerEnergy = towerEnergy + tower.store.getUsedCapacity('energy');
      if (tower.store.getUsedCapacity('energy') <= 400) {
        room.memory.tEnergy[tower.id] = tower.store.getFreeCapacity('energy');
      }
    });
    // console.log('t-cpu', Game.cpu.getUsed() - cpu);

    // const totalTowerEnergy = towers.length * 1000;
    // console.log('towerEnergy', towerEnergy, totalTowerEnergy, towerEnergy / totalTowerEnergy);
    // if (room.controller.level >= 7 && towerEnergy < 1000) {
    //   console.log('additional', 'tHauler', towerEnergy);
    // }

    // return towerEnergy;
  }
}

module.exports = towerService;
