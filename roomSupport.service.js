const w5 = [WORK, WORK, WORK, WORK, WORK];
const m5 = [MOVE, MOVE, MOVE, MOVE, MOVE];
const m10 = [...m5, ...m5]; // 500
const c5 = [CARRY, CARRY, CARRY, CARRY, CARRY]; // 250
const m10c10 = [...c5, ...m5, ...c5, ...m5]; // 500 capacity
const a5 = [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK]; // 400
const ra5 = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK]; // 400
const a10 = [...a5, ...a5]; // 800
const ra10 = [...ra5, ...ra5];
const h5 = [HEAL, HEAL, HEAL, HEAL, HEAL]; // 1250
const h10 = [...h5, ...h5]; // 2500

const roomSupport = {
  getSourceMem(room) {
    let sourceMem = room.memory.sources || {};
    if (Object.keys(sourceMem).length === OK) {
      sourceMem = room.find(FIND_SOURCES).reduce((acc, s) => {
        acc[s.id] = {};
        return acc;
      }, {});
    }
    return sourceMem
  },
  getWorkers: function(memory, key) {
    const names = typeof memory[key] !== 'undefined' ? memory[key] : [];
    const workers = [];
    names.forEach(name => {
      const creep = Game.creeps[name];
      if (creep) workers.push(name);
    });
    return workers;
  },
  supportRoom(room, spawnController, energyStore = null) {
    if (room.controller.level >= 6) {
      room.memory.support = undefined;
    }

    if (Game.time % 50 == OK) {
      const sourceMem = roomSupport.getSourceMem(room);
      sourceMem && Object.keys(sourceMem).forEach(id => {
        const mem = sourceMem[id];
        let miner = mem.miner && Game.creeps[mem.miner];          
        if (!miner) {
          // if container, should I send a bigger model?
          const res = spawnController.createDrone('miner', [MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK], { homeRoom: room.name, targetRoom: room.name, source: id });
          if (res.status === OK) {
            mem.miner = res.name;
          }
        }
        sourceMem[id] = mem;
      });
      room.memory.source = sourceMem;

      // what if I already had one?
      const haulers = roomSupport.getWorkers(room.memory, 'haulers');
      if (haulers.length < 1) {
        const res = spawnController.createDrone('hauler', m10c10, { targetRoom: room.name, homeRoom: room.name });
        if (res.status === OK) {
          haulers.push(res.name);
          room.memory.haulers = haulers;
        }
      }

      const upgradeContainer = room.memory.upgradeContainer
        ? Game.getObjectById(room.memory.upgradeContainer)
        : room.controller.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } });

      if (upgradeContainer) {
        if (energyStore) {
          const eHaulers = roomSupport.getWorkers(room.memory, 'eHaulers');
          if (eHaulers.length < 2) {
            const res = spawnController.createDrone('eHauler', [...m10c10, ...m10c10], { targetRoom: room.name, energyStore, targetStore: upgradeContainer.id });
            if (res.status === OK) {
              eHaulers.push(res.name);
              room.memory.eHaulers = eHaulers;
            }
          }
        }

        const upgraders = roomSupport.getWorkers(room.memory, 'upgraders');
        if (upgraders.length < 2) {
          const body = [...w5, ...m5, ...w5, ...m5, ...c5, CARRY];
          const res = spawnController.createDrone('upgrader', body, { targetRoom: room.name });
          if (res.status === OK) {
            upgraders.push(res.name);
            room.memory.upgraders = upgraders;
          }
        }
      }

      // if (room.memory['build-targets']) {
      //   const drones = roomSupport.getWorkers(room.memory, 'drones');
      //   if (drones.length < 1) {
      //     const res = spawnController.createDrone('drone', [...m5, ...w5, ...c5, ...m5], { targetRoom: room.name, homeRoom: room.name });
      //     if (res.status === OK) {
      //       drones.push(res.name);
      //       room.memory.drones = drones;
      //     }
      //   }

      //   const bhaulers = roomSupport.getWorkers(room.memory, 'bhaulers');
      //   if (energyStore && bhaulers.length < 1) {
      //     const res = spawnController.createDrone('eHauler', m10c10, { targetRoom: room.name, energyStore });
      //     if (res.status === OK) {
      //       bhaulers.push(res.name);
      //       room.memory.bhaulers = bhaulers;
      //     }
      //   }
      // }
    }
  },
  captureRoom(flag, spawnController) {
    if (typeof flag.memory !== 'object') flag.memory = { flagbearer: null, drone: null };

    if (flag.room && flag.room.controller.my) {
      if (Game.time % 5 === OK) {
        const room = flag.room;
        // build spawn
        if (!flag.memory.spawnSite) {
          const spawnSite = flag.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, { filter: (site) => site.structureType === STRUCTURE_SPAWN });
          if (spawnSite) {
            flag.memory.spawnSite = spawnSite.id;
          } else {
            flag.room.createConstructionSite(flag.pos, STRUCTURE_SPAWN, flag.memory.spawnName);
          }
        }

        if (!spawnController.spawning) {
          // miners and drones are provided per source until the first set of extensions is complete
          if (room.energyCapacityAvailable < 550) {
            let sources = flag.memory.sources ? flag.memory.sources.map(id => Game.getObjectById(id)) : (() => {
              const sources = room.find(FIND_SOURCES);
              flag.memory.sources = sources.map(s => s.id);
              return sources;
            })();

            sources.forEach(source => {
              let miner = flag.memory[source.id] && Game.creeps[flag.memory[source.id]];          
              if (!miner) {
                const res = spawnController.createDrone('miner', [MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK], { targetRoom: room.name, source: source.id });
                if (res.status === OK) {
                  flag.memory[source.id] = res.name;
                }
              }
            });
          }

          const upgradeContainer = room.memory.upgradeContainer
            ? Game.getObjectById(room.memory.upgradeContainer)
            : room.controller.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } });
          if (!upgradeContainer && room.energyCapacityAvailable <= 550) {
            const drones = roomSupport.getWorkers(flag.memory, 'drones');
            if (drones.length < 2) {
              const res = spawnController.createDrone('drone', [MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE], { targetRoom: room.name });
              if (res.status === OK) {
                drones.push(res.name);
                flag.memory.drones = drones;
              }
            }
          } else if (!room.memory.upgradeContainer) {
            const container = room.controller.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } });
            if (container) room.memory.upgradeContainer = container.id;
          }

          const eHaulers = roomSupport.getWorkers(flag.memory, 'eHaulers');
          if (eHaulers.length < 2) {
            const targetStore = upgradeContainer ? upgradeContainer.id : null;
            let body = targetStore ? [...m10c10, ...m10c10] : m10c10;
            const res = spawnController.createDrone('eHauler', body, { targetRoom: room.name, energyStore: flag.storage, targetStore });
            if (res.status === OK) {
              eHaulers.push(res.name);
              flag.memory.eHaulers = eHaulers;
            }
          }

          if (upgradeContainer) {
            const upgraderLimit = upgradeContainer ? 2 : 1;
            const upgraders = roomSupport.getWorkers(flag.memory, 'upgraders');
            if (upgraders.length < upgraderLimit) {
              const res = spawnController.createDrone('upgrader', [...w5, ...m5,CARRY,CARRY,CARRY, ...w5, ...m5,CARRY,CARRY,CARRY], { targetRoom: room.name });
              if (res.status === OK) {
                upgraders.push(res.name);
                flag.memory.upgraders = upgraders;
              }
            }

            const haulers = roomSupport.getWorkers(flag.memory, 'haulers');
            if (haulers.length < 1) {
              const res = spawnController.createDrone('hauler', [...m10c10], { targetRoom: room.name, homeRoom: room.name });
              if (res.status === OK) {
                haulers.push(res.name);
                flag.memory.haulers = haulers;
              }
            }
          }
        }

        if (room.controller.level >= 3) {
          flag.memory = {};
          flag.remove();
        }
      }
    } else {
      // the room isn't claimed; spawn the flagbearer and assign to the flag
      const flagbearer = this.findCreeps(c => c.memory.job === 'flagbearer' && c.memory.flag === flag.name).onFirst(c => c);

      if (!flagbearer && !spawnController.spawning) {
        const status = spawnController.createDrone('flagbearer', [CLAIM,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE], { flag: flag.name, targetRoom: null, });
        if (status === OK) flag.memory.flagbearer = creep.name;
      }
    }
  },
  mineCentralRoom(spawnController, flag) {
    if (Game.time % 5 !== OK) return;
    const mem = flag.mem;
    const targetRoom = flag.room.name;

    const healers = roomSupport.getWorkers('healers');
    if (healers.length < 1) {
      const res = spawnController.createDrone('healer', [...m10, ...h10], { flag: flag.name });
      if (res.status === OK) {
        healers.push(res.name);
        flag.room.memory.healers = healers;
      }
    }

    const rangers = roomSupport.getWorkers('rangers');
    if (rangers.length < 1) {
      const res = spawnController.createDrone('ranger', [...m10, ...m10, ...ra10, ...ra10], { flag: flag.name });
      if (res.status === OK) {
        rangers.push(res.name);
        flag.room.memory.rangers = rangers;
      }
    }

    if (flag.memory.mineral) {
      const mineral = Game.getObjectById(flag.memory.mineral);
      if (mineral && mineral.mineralAmount > 0) {
        const keepers = mineral.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
        if (keepers.length === OK) {
          const miners = roomSupport.getWorkers('miners');
          if (miners.length < 1) {
            const res = spawnController.createDrone('miner', [...m10, ...w5, ...w5], { targetRoom, source: mineral.id });
            if (res.status === OK) {
              miners.push(res.name);
              flag.room.memory.miners = miners;
            }
          }

          const haulers = roomSupport.getWorkers('haulers');
          if (haulers.length < 1) {
            const res = spawnController.createDrone('hauler', [...m10, ...c5, ...c5], { targetRoom, source: mineral.id });
            if (res.status === OK) {
              haulers.push(res.name);
              flag.room.memory.haulers = haulers;
            }
          }
        }
      }
    } else {
      flag.room.find(FIND_MINERALS).onFirst(m => flag.memory.mineral = m.id);
    }
  },
}

module.exports = roomSupport;
