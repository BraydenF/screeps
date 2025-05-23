// tower management system
const spawn = Game.spawns['spawn'];
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
  getHostileTarget: function() {
    const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    // todo: target healers first
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

      if (hauler.memory.task !== 'unload') {
        hive.set(`towerHauler-${tower.id}`, null);
        console.log(`${hauler.name} released`);
      }
    }

    return towerHauler;
  },
  run: function(tower) {
    const hasLowEnergy = towerService.getEnergyStatus(tower) === 'low-energy';
    const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    const damagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, { filter:
      (creep) => creep.hits !== creep.hitsMax,
    });

    if (closestHostile) {
      console.log(`User ${closestHostile.owner.username} spotted!`);
      const status = tower.attack(closestHostile);
    }
    else if (damagedCreep) {
      tower.heal(damagedCreep);
    }
    else if (!hasLowEnergy) {
      const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, { filter: (structure) => {
        return structure.hitsMax - structure.hits >= 800 && (
          !(structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) ||
          (structure.structureType === STRUCTURE_WALL && structure.hits < defaultTowerConfig.min_wall) ||
          (structure.structureType === STRUCTURE_RAMPART && structure.hits < defaultTowerConfig.min_wall)
        )
      }});

      if (closestDamagedStructure) {
        tower.repair(closestDamagedStructure);
      }
    }
  }
}

module.exports = towerService;
