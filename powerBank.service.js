const roomSupport = require('roomSupport.service');

// global.Spawn3.createDrone('power-hauler', [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE], { targetRoom:'E10N54'});

/**
 * - Power capture should be updated to limit to a single bank attack to preserve cpu
 * - level 4 factories (~GPL 34 -> 800k power)
 * - level 5 factories (~GPL 57 -> 1.8mil power)
 */
const powerBankService = {
  spawnSiegeUnits(mem, spawnController) {
    const healers = roomSupport.getWorkers(mem, 'healers');
    const bankRams = roomSupport.getWorkers(mem, 'bankRams');
    // const bankTanks = roomSupport.getWorkers(mem, 'bankTanks');

    // const soldierLimit = mem.walkablePositions;
    const spawnRam = bankRams.length >= 2 ? (() => {
      if (bankRams.length >= 2 || bankRams.length > healers.length) return false; // hard capped at three
      let totalTtl = 0;
      for (const name of bankRams) {
        const creep = Game.creeps[name];
        if (creep && creep.ticksToLive) {
          totalTtl = totalTtl + creep.ticksToLive;
        }
      }
      const ttlRatio = totalTtl / (bankRams.length * 1500);
      return ttlRatio <= 0.25;
    })() : true;

    if (spawnRam) {
      const body = [TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ...m5, ...m10, ...a10, ...a10, ...m10];
      const res = spawnController.createDrone('bankRam', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
      if (res.status === OK) {
        bankRams.push(res.name);
        mem.bankRams = bankRams;
        mem.squad.push(res.name);
      }
    } else {
      mem.nextCheckTime = mem.nextCheckTime + 12;
    }

    if (healers.length < 4 && healers.length < bankRams.length + 1) {
      const body = [...m10, ...m10, ...m5, ...h5, ...h10, ...h10];
      const res = spawnController.createDrone('healer', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
      if (res.status === OK) {
        healers.push(res.name);
        mem.healers = healers;
        mem.squad.push(res.name);
      }
    } else {
      mem.nextCheckTime = mem.nextCheckTime + 17;
    }

    // todo: add a note to memory to indicate when a room is often contested
    // if (bankTanks.length < 1) {
    //   const body = [...m10, ...m10, ...m5, ...ra10, ...ra5, ...h10];
    //   const res = spawnController.createDrone('bankTank', body, { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
    //   if (res.status === OK) {
    //     bankTanks.push(res.name);
    //     mem.bankTanks = bankTanks;
    //   }
    // }
    return mem;
  },
  spawnPowerHaulers(mem, spawnController) {
    const haulers = roomSupport.getWorkers(mem, 'haulers');
    const fullHaulerCount = Math.round(mem.power / 1250);
    if (haulers.length < fullHaulerCount) {
      const res = spawnController.createDrone('power-hauler', [...m10c10, ...m5c5, ...m10c10], { targetRoom: mem.room, target: mem.id, powerBank: mem.id });
      if (res.status === OK) {
        haulers.push(res.name);
        mem.haulers = haulers;
        mem.squad.push(res.name);
      }
    }
    return mem;
  },
  capture(mem) {
    const rooms = [mem.primaryRoom, ...(mem.supportRooms || [])];
    rooms.forEach(name => {
      const room = Game.rooms[name];
      const hive = room.getHive();

      if (hive) {
        if (!mem.squad) mem.squad = [];
        if (mem.hits >= 50000) {
          mem = powerBankService.spawnSiegeUnits(mem, hive.spawnController);
        }

        // testing requiring having rams to create haulers, rams could be invalid at this point...

        if (mem.hits <= 500000 && mem.bankRams.length > 0) {
          mem = powerBankService.spawnPowerHaulers(mem, hive.spawnController);
        }
      }
    });

    return mem;
  },
  run() {
    try {
      const powerBanks = Memory.powerBanks;
      if (!global.squads) global.squads = {};
      // let siegingBanks = false;

      if (global.hasKeys(powerBanks)) {
        for (const id in powerBanks) {
          let mem = Memory.powerBanks[id];
          const ttl = mem.expectedDecay - Game.time;
          const killable = ttl * 1500 >= mem.hits;
          const primaryRoom = mem && Game.rooms[mem.primaryRoom];

          // there is a chance the memory is lagging and my team is just ahead of the fine line...
          if (mem.expectedDecay <= Game.time || !killable) {
            primaryRoom.memory.powerBank = null;
            powerBanks[id] = undefined;
          } else if (mem && (mem.nextCheckTime || 0) <= Game.time) {
            const primaryHive = primaryRoom.getHive();
            powerBanks[id].nextCheckTime = Game.time + 11;

            // bucket check likely limits things to a single powerBank
            if (!primaryRoom.memory.powerBank && killable && (!mem.hostiles || mem.hostiles === 0) && Game.cpu.bucket >= 10000) {
              const storedEnergy = primaryHive.storage.store.getUsedCapacity('energy');
              const hasEnergy = primaryHive && storedEnergy >= 100000 && primaryHive.getEnergyPercentage() > 0.75;
              const hasMinPower = mem.power >= (primaryRoom.storage.store['power'] || 0); // target power banks with more energy than myself

              if (hasEnergy && hasMinPower) {
                Game.rooms[mem.primaryRoom].memory.powerBank = id;
              }
            }

            if (primaryRoom.memory.powerBank === id) {
              const room = Game.rooms[mem.room];
              if (room) {
                const powerBank = Game.getObjectById(id);
                if (powerBank) {
                  powerBanks[id].hits = powerBank.hits;
                } else {
                  if (!powerBanks[id].aproxKillTime) {
                    powerBanks[id].aproxKillTime = Game.time;
                    powerBanks[id].hits = 0;
                  } else if (powerBanks[id].aproxKillTime + 25 > Game.time) {
                    // there is a 10 tick period where the power and bank both don't exist...
                    const droppedPower = room.find(FIND_DROPPED_RESOURCES, { filter: { resourceType: 'power' }});
                    if (droppedPower.length === 0) {
                      console.log('POWER BANK COMPLETE', room.name);
                      // powerBanks[id] = undefined;
                      // primaryRoom.memory.powerBank = null;
                    }
                  }
                }
              }

              if (mem.hostiles === 0) {
                // I should convert some batteries if I have them to create a stable energy pool.
                // if (!mem.convertedBatteries && this.room.storage.store['battery'] > 25000) {
                //   if (factoryController && factoryController.isAcceptingJobs()) {
                //     .convertedBatteries = true;
                //     factoryController.setJob('energy', 20000);
                //   }
                // }

                powerBanks[id] = powerBankService.capture(mem); 
              } else {
                // mem = roomSupport.scoutRoom(mem, mem.room, primaryHive.spawnController);
              }

              // should I rescan to allow for rooms to be picked up or dropped off from supporting?
              if (!mem.supportRooms) {
                powerBanks[id].supportRooms = [];
                Object.keys(global.hives).forEach(roomName => {
                  if (roomName !== mem.primaryRoom) {
                    const hive = global.hives[roomName];
                    // I should use find route instead, and see how far it is..
                    const route = GameMap.findRoute(mem.room, roomName);
                    // const distance = Game.map.getRoomLinearDistance(mem.room, roomName);
                    // todo: ensure the room has enough capacity to participate in spawning
                    // could I create an array of helper rooms??
                    if (hive && hive.storage && !hive.room.memory.powerBank && route.length <= 7 && hive.storage.store.getUsedCapacity('energy') >= 85000) {
                      powerBanks[id].supportRooms.push(roomName);
                    }
                  }
                });
              }
            }
          }

          // manages the squad for creep lookups
          if (mem.squad && mem.squad.length > 0) {
            global.squads[id] = [];
            for (const name of mem.squad) {
              const creep = Game.creeps[name];
              if (creep) global.squads[id].push(creep);
            }
            // siegingBanks = true;
          }
        };
        Memory.powerBanks = powerBanks;
      }

      // if (Memory.siegingBanks !== siegingBanks) Memory.siegingBanks = siegingBanks;
    } catch (e) {
      console.log(e);
    }
  },
}

module.exports = powerBankService;
