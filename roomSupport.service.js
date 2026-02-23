
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
  getSourceContainer(source) {

  },
  getWorkers: function(memory, key) {
    const names = typeof memory[key] !== 'undefined' ? memory[key] : [];
    const workers = [];
    names.forEach(name => {
      const creep = Game.creeps[name];
      if (creep) workers.push(name);
    });
    memory[key] = workers;
    return workers;
  },
  scoutRoom(mem, room, spawnController) {
    const scout = mem.scout && Game.creeps[mem.scout];
    if (!scout) {
      const res = spawnController.createDrone('scout', [MOVE,MOVE], { targetRoom: room });
      if (res.status === OK) {
        mem.scout = res.name;
      }
    }
    return mem;
  },
  defendRoom(hive, room) {
    // if (room.controller.owner) externalSources[room.name].disabled = true;
    const invaders = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: 'Invader' } } });
    if (invaders.length > 0) {
      const gunship = hive.findCreeps(c => c && c.memory.job === 'gunship' && c.memory.targetRoom === room.name).onEmpty(() => {
        let body = hive.controller.level >= 7 ? [...m10, ...ra10] : [...m5, ...ra5];
        hive.spawnController.createDrone('gunship', body, { targetRoom: room.name, target: invaders[0].id });
      });
    }

    const invaderCores = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } });
    if (invaderCores.length > 0) {
      const soldiers = hive.findCreeps(c => c && c.memory.job === 'soldier' && c.memory.targetRoom === room.name).onEmpty(() => {
        const target = invaders.length > 0 ? invaders[0].id : invaderCores[0].id;
        let body = hive.controller.level >= 7 ? [...m10, ...a10] : [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK];
        hive.spawnController.createDrone('soldier', body, { targetRoom: room.name, target });
      });
    }
  },
  assertAuthority(hive, roomName) {
    const room = Game.rooms[roomName];
    const reservation = room && room.controller.reservation;
    let owned = reservation && reservation.owner === Game.username;

    if (!reservation || (owned && reservation.ticksToEnd < 3500)) {
      hive.findCreeps(c => c && c.memory.job === 'flagbearer' && c.memory.targetRoom === roomName).onEmpty(() => {
        let body = hive.room.controller.level >= 7 ? [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM] : [MOVE, MOVE, CLAIM, CLAIM];
        if (hive.room.energyCapacityAvailable < 1400) body = [MOVE, CLAIM];
        hive.spawnController.createDrone('flagbearer', body, { targetRoom: roomName });
      });
    }

    return owned;
  },
  simpleMiningTeam(hive, roomName, sourceMem, targetStore) {
    const miner = sourceMem.miner && Game.creeps[sourceMem.miner];
    const haulers = roomSupport.getWorkers(sourceMem, 'haulers');
    const creepMemory = { targetRoom: roomName, source: sourceMem.id, targetStore };

    const hasOptimalCap = hive.room.energyCapacityAvailable >= 1000;
    const desiredHaulerCount = hasOptimalCap ? 2 : 3;
    if (!miner || miner.ticksToLive <= 33) {
      const res = hive.spawnController.createDrone('miner', [MOVE,MOVE,MOVE,WORK,WORK,WORK], creepMemory); // 450
      if (res.status === OK) sourceMem.miner = res.name;
    } else if (haulers.length < desiredHaulerCount) {
      const body = hasOptimalCap ? m10c10 : m5c5;
      const res = hive.spawnController.createDrone('hauler', body, creepMemory); // 500
      if (res.status === OK) haulers.push(res.name);
    }
  },
  runKeeperTeam(hive, room, sourceMem) {
    let keeper = sourceMem.keeper && Game.creeps[sourceMem.keeper];
    if (!keeper) keeper = hive.getCreepWithSource('keeper', sourceMem.id);
    if (!Game.creeps[sourceMem.keeper] && keeper) sourceMem.keeper = keeper.name;
    const container = room && sourceMem.container && Game.getObjectById(sourceMem.container) ? Game.getObjectById(sourceMem.container) : (() => {
      const source = Game.getObjectById(sourceMem.id);
      const container = source && source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
      if (container) sourceMem.container = container.id;
      return container;
    })();

    const allowed = !container || (container && container.store.getFreeCapacity('energy') >= 0)
    if (allowed && (!keeper || keeper.ticksToLive < 33)) {
      let body = [...w5, MOVE, WORK, ...m5, CARRY, CARRY, CARRY, CARRY]; // cost 1050
      hive.spawnController.setNextSpawn({ job: 'keeper', body: body, memory: { targetRoom: room.name, source: sourceMem.id } });
    }

    if (room) {
      const container = sourceMem.container && Game.getObjectById(sourceMem.container) ? Game.getObjectById(sourceMem.container) : (() => {
        const source = Game.getObjectById(sourceMem.id);
        const container = source && source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
        if (container) sourceMem.container = container.id;
        return container;
      })();

      if (container) {
        const haulers = Object.keys(hive.creeps).filter(id => {
          const mem = hive.creeps[id] && hive.creeps[id].memory;
          if (mem && mem.job === 'hauler' && mem.targetRoom === room.name && mem.source === sourceMem.id) {
            return hive.creeps[id];
          }
        });

        const hasOptimalCap = hive.room.energyCapacityAvailable >= 1600;
        const desiredHaulerCount = hasOptimalCap ? 1 : 2;
        if (!haulers || haulers.length < desiredHaulerCount) {
          let body = hasOptimalCap ? [...m10c10, ...m2c2, ...m2c2, ...m2c2,] : m10c10;
          hive.spawnController.setNextSpawn({ job: 'hauler', body, memory: { targetRoom: room.name, source: sourceMem.id, container: container.id } });
        }
      } else {
        // construct the container!
        const source = Game.getObjectById(sourceMem.id);
        if (source) {
          // todo: the room memory could be updated by the hive here to avoid the search.
          const cSite = source.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_CONTAINER } });
          if (!cSite) {
            const ret = PathFinder.search(source.pos, hive.room.storage.pos, { maxRooms: 1 });
            room.createConstructionSite(ret.path[0], STRUCTURE_CONTAINER); // ret.path[0]
          }
        }
      }
    }
  },
  manageOutposts(hive) {
    const outposts = hive.get('outposts') || {};
    // const enabled = controllerLevel !== 8 || (!capturingPower && hive.room.storage.store.getUsedCapacity('energy') <= 250000);

    for (const roomName in outposts) {
      if ((outposts[roomName] || 0) <= Game.time) {
        const mem = Memory.rooms[roomName] || {};
        roomSupport.manageOutpost(hive, roomName);
      }
    }
  },
  manageOutpost(hive, roomName) {
    const mem = Memory.rooms[roomName] || {};
    const room = Game.rooms[roomName];
    if (mem.disabled || !((mem.nextCheck || 0) < Game.time)) return;

    const reservation = room && room.controller.reservation;
    let mineable = reservation && reservation.owner === Game.username;

    if (!reservation || (mineable && reservation.ticksToEnd < 3500)) {
      hive.findCreeps(c => c && c.memory.job === 'flagbearer' && c.memory.targetRoom === roomName).onEmpty(() => {
        const body = hive.room.controller.level >= 7 ? [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM] : [MOVE, CLAIM];
        const claim = hive.room.level >= 5 ? roomName : undefined;
        hive.spawnController.createDrone('flagbearer', body, { targetRoom: roomName, claim });
      });
    }

    if (room) {
      if (room.controller.owner) externalSources[roomName].disabled = true;
      const invaders = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: 'Invader' } } });
      if (invaders.length > 0) {
        const gunship = hive.findCreeps(c => c && c.memory.job === 'gunship' && c.memory.targetRoom === roomName).onEmpty(() => {
          let body = hive.controller.level >= 7 ? [...m10, ...ra10] : [...m5, ...ra5];
          hive.spawnController.createDrone('gunship', body, { targetRoom: roomName, target: invaders[0].id });
        });
      }

      const invaderCores = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } });
      if (invaderCores.length > 0) {
        const soldiers = hive.findCreeps(c => c && c.memory.job === 'soldier' && c.memory.targetRoom === roomName).onEmpty(() => {
          const target = invaders.length > 0 ? invaders[0].id : invaderCores[0].id;
          let body = hive.controller.level >= 7 ? [...m10, ...a10] : [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK];
          hive.spawnController.createDrone('soldier', body, { targetRoom: roomName, target });
        });
      }
    }

    if (mem.sources && mineable) {
      for (const id in mem.sources) {
        const sourceMem = mem.sources[id];
        if (sourceMem.disabled) return sourceMem;

        let keeper = sourceMem.keeper && Game.creeps[sourceMem.keeper];
        if (!keeper) keeper = hive.getCreepWithSource('keeper', id);
        if (!Game.creeps[sourceMem.keeper] && keeper) sourceMem.keeper = keeper.name;

        const container = sourceMem.container && Game.getObjectById(sourceMem.container) ? Game.getObjectById(sourceMem.container) : (() => {
          const source = Game.getObjectById(id);
          const container = source && source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).onFirst(s => s);
          if (container) sourceMem.container = container.id;
          return container;
        })();

        const allowed = !container || (container && container.store.getFreeCapacity('energy') >= 0)
        if (allowed && (!keeper || keeper.ticksToLive < 25)) {
          let body = [...w5, MOVE, WORK, ...m5, CARRY, CARRY, CARRY, CARRY]; // cost 1050
          hive.spawnController.setNextSpawn({ job: 'keeper', body: body, memory: { targetRoom: roomName, source: sourceMem.id } });
        }

        if (room) {
          if (container) {
            const haulers = Object.keys(hive.creeps).filter(id => {
              const mem = hive.creeps[id] && hive.creeps[id].memory;
              if (mem && mem.job === 'hauler' && mem.targetRoom === roomName && mem.source === sourceMem.id) {
                return hive.creeps[id];
              }
            });

            const hasOptimalCap = hive.room.energyCapacityAvailable >= 1600;
            const desiredHaulerCount = hasOptimalCap ? 1 : 2;
            if (!haulers || haulers.length < desiredHaulerCount) {
              let body = hasOptimalCap ? [...m10c10, ...m2c2, ...m2c2, ...m2c2,] : m10c10; // 1600
              hive.spawnController.setNextSpawn({ job: 'hauler', body, memory: { targetRoom: roomName, source: sourceMem.id, container: container.id } });
            }
          } else {
            // construct the container!
            const source = Game.getObjectById(sourceMem.id);
            if (source) {
              // todo: the room memory could be updated by the hive here to avoid the search.
              const cSite = source.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_CONTAINER } });
              if (!cSite) {
                const ret = PathFinder.search(source.pos, hive.room.storage.pos, { maxRooms: 1 });
                room.createConstructionSite(ret.path[0], STRUCTURE_CONTAINER); // ret.path[0]
              }
            }
          }
        }
      }
    } else if (!mem.sources && room) {
      mem.sources = {};
      room.find(FIND_SOURCES).forEach(s => mem.sources[s.id] = { id: s.id, container: null, keeper: null });
      Memory.rooms[roomName] = mem;
    }
  },
  supportRoom(room, spawnController, energyStore = null) {
    if (room.controller.level >= 7) {
      // room.memory.supporting = undefined;
      Memory.rooms[room.name].supporting = undefined;
    }

    // turn off extra units when bucket is draining
    if (Game.time % 50 == OK && room.controller.my && Game.cpu.bucket > 8500) {
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

      // assists in room getting to using links
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

        const desiredUpgraderCount = room.controller.level >= 5 ? 2 : 1;
        const upgraders = roomSupport.getWorkers(room.memory, 'upgraders');
        if (upgraders.length < desiredUpgraderCount && upgradeContainer.store['energy'] >= 1500) {
          const body = [...w5, ...m5, ...w5, ...m5, ...c5, CARRY];
          const res = spawnController.createDrone('upgrader', body, { targetRoom: room.name });
          if (res.status === OK) {
            upgraders.push(res.name);
            room.memory.upgraders = upgraders;
          }
        }
      }

      // assist in early building
      if (room.controller.level <= 6) {
        if (room.memory['build-targets'] && room.memory['build-targets'].length > 0) {
          const drones = roomSupport.getWorkers(room.memory, 'drones');
          if (drones.length < 1) {
            const res = spawnController.createDrone('drone', [...m5, ...w5, ...c5, ...m5, ...c5, ...m5], { targetRoom: room.name, homeRoom: room.name });
            if (res.status === OK) {
              drones.push(res.name);
              room.memory.drones = drones;
            }
          }

          const bhaulers = roomSupport.getWorkers(room.memory, 'bhaulers');
          if (energyStore && bhaulers.length < 1) {
            const res = spawnController.createDrone('eHauler', m10c10, { targetRoom: room.name, energyStore });
            if (res.status === OK) {
              bhaulers.push(res.name);
              room.memory.bhaulers = bhaulers;
            }
          }
        } else {
          const buildTargets = room.find(FIND_CONSTRUCTION_SITES).map(c => c.id);
          if (buildTargets.length > 0) {
            room.memory.buildTargets = buildTargets;
          }
        }
      }
    }
  },
  captureRoom(flag, spawnController) {
    if (typeof flag.memory !== 'object') flag.memory = { flagbearer: null, drone: null };

    if (flag.room && flag.room.controller.my) {
      if (Game.time % 50 === OK) {
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
            : room.controller.pos.findInRange(FIND_STRUCTURES, 3, { filter: { structureType: STRUCTURE_CONTAINER } }).first();
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
          const targetStore = upgradeContainer ? upgradeContainer.id : null;
          if (eHaulers.length < 2 && targetStore) {
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

        if (room.controller.level >= 3 && (!flag.memory.spawnSite && room.find(FIND_MY_SPAWNS).length > 0)) {
          flag.memory = {};
          flag.remove();
          // if there is only one source, should I begin to suport the room automatically?
        }
      }
    } else {
      // the room isn't claimed; spawn the flagbearer and assign to the flag
      let flagbearer = flag.memory.flagbearer && Game.creeps[flag.memory.flagbearer];

      if (!flagbearer && !spawnController.spawning) {
        let body = [CLAIM,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
        if (flag.memory.siege) {
          if (Game.time - flag.memory.lastControllerAttack < 1000) return;
          body = [...m5, ...m5, CLAIM, CLAIM, CLAIM, CLAIM, CLAIM];
        }

        const res = spawnController.createDrone('flagbearer', body, { flag: flag.name, targetRoom: null, });
        if (res.status === OK) {
          flag.memory.flagbearer = res.name;
          flag.memory.lastControllerAttack = Game.time;
        }
      }
    }
  },
  claimLoot(mem, room) {
    if (Game.time % 100 === 0 && Game.cpu.bucket > 7000) {
      const lootable = Memory.lootables || {};
      for (const room in lootable) {
        const mem = lootable[room];
        const hive = global.hives[mem.hive];
        if (hive) {
          const sweepers = roomSupport.getWorkers(mem, 'sweepers');
          if (sweepers.length < 2) {
            const res = hive.spawnController.createDrone('sweeper', [...m10c10, ...m10c10], { targetRoom: room });
            if (res.status === OK) {
              mem.sweepers.push(res.name);
            }
          }
        }
      }
      lootable[room] = mem;
    }
  },
}

/**
 * Strongholds - destroy and capture resources from an inner room stronghold
 * a room is identified and an attack plan is stratigized
 * spawn healers to drain towers; folllowed by siege units.
 * loot the containers
 */
roomSupport.strongholds = {
  siege(roomName, mem) {
    // invaderCore
    // towers
    // ramparts
    // containers
    const hive = global.hives[mem.hive];
    const room = Game.rooms[roomName];
    if (room) {

    }

    // todo: a sapper squad of a healer with a few bouncers would be much more effective
    // A sapper won't work, the energy resets at 0..
    // towers will need to be sieged fr...
    // const sappers = roomSupport.getWorkers('sappers');
    // if (sappers.length < 2) {
    //   const res = hive.spawnController.createDrone('sapper');
    //   if (res.name) {
    //     mem.sappers.push(res.name);
    //   }
    // }
  },
  run() {
    if (Memory.strongholds) {
      for (const room in Memory.strongholds) {
        const mem = Memory.strongholds[room];
        if ((mem.nextRun || 0) <= Game.time) {
          roomSupport.strongholds.siegeStronghold(room, mem);
        }
      }
    }
  },
}

/**
 * - Excavations
 * -- Add auto job start rules for mining internal rooms. I should probably onlt mine when I dont have it in storage.
 * -- Power should take priority over mineral gathering; Should this get a mode to prevent reinforcement?
 * -- excavations should run X ticks and determine if continuation is okay given energy reserves.. 
 * -
 * 
 */
const excavationService = {
  getMiningPosition(mineral, lair) {
    // Find the position adjacent to mineral that is furthest from the lair
    var bestPos = null;
    var maxDistance = -1;

    // Get all positions adjacent to the mineral
    const adjPositions = GameMap.getWalkablePositions(mineral.pos);

    // Among valid adjacent positions, pick the one furthest from lair
    for (var i = 0; i < adjPositions.length; i++) {
      var pos = adjPositions[i];
      var dist = pos.getRangeTo(lair.pos);
      if (dist > maxDistance) {
        maxDistance = dist;
        bestPos = pos;
      }
    }

    if (bestPos) {
      return {
        x: bestPos.x,
        y: bestPos.y,
        roomName: bestPos.roomName
      };
    }
  },
  run() {
    const excavations = Memory.excavations;
    for (const name in excavations) {
      const plan = excavations[name];

      if (plan) {
        if ((plan.nextRun || 0) <= Game.time) {
          const hive = global.hives[plan.hive];
          plan.nextRun = Game.time + 23;

          // when do I make a plan active? Do I only do it manually for the time being?
          // this is lower priority than a powerbank;

          if (hive && hive.spawnController && plan.active) {
            const room = Game.rooms[name];
            if (room) {
              const mineral = Game.getObjectById(plan.mineral);
              const lair = Game.getObjectById(plan.lair);
              if (mineral && mineral.ticksToRegeneration) {
                plan.nextRun = Game.time + mineral.ticksToRegeneration;
                plan.active = false;
                plan.antiKeepers = [];
                plan.miners = [];
                plan.haulers = [];
              }
              if (!plan.walkablePositions) {
                plan.walkablePositions = GameMap.getWalkablePositions(mineral.pos).length;
              }
              if (lair && !plan.miningPosition) {
                plan.miningPosition = excavationService.getMiningPosition(mineral, lair);
              }
            }

            const sharedMemory = { targetRoom: name, source: plan.mineral, lair: plan.lair };

            const antiKeepers = plan.lair ? roomSupport.getWorkers(plan, 'antiKeepers') : null;
            if (plan.lair && antiKeepers.length < 2) {
              const res = hive.spawnController.createDrone('anti-keeper', [...m10, ...m10, ...m5, ...ra10, ...ra10, ...h5], sharedMemory);
              if (res.status === OK) {
                if (!plan.antiKeepers) plan.antiKeepers = [];
                plan.antiKeepers.push(res.name);
              }
            } else {
              // a guard must be alive to start spawning
              const miners = roomSupport.getWorkers(plan, 'miners');
              const haulers = roomSupport.getWorkers(plan, 'haulers');

              const minerCount = plan.walkablePositions && plan.walkablePositions > 1 ? 2 : 1;
              if (miners.length < minerCount) {
                const res = hive.spawnController.createDrone('excavator', [...w10, ...w10, MOVE, MOVE, MOVE, ...m10, ...m10, CARRY, CARRY], { ...sharedMemory, miningPosition: plan.miningPosition });
                if (res.status === OK) {
                  if (!plan.miners) plan.miners = [];
                  plan.miners.push(res.name);
                }
              }
              if (miners.length > 0 && haulers.length < minerCount + 1) {
                // haulers will probably need a staging location to stay safe.
                const res = hive.spawnController.createDrone('mineral-hauler', [...m10, ...m10, ...c10, ...c10], { ...sharedMemory, miningPosition: plan.miningPosition });
                if (res.status === OK) {
                  if (!plan.haulers) plan.haulers = [];
                  plan.haulers.push(res.name);
                }
              }

              if (miners.length >= 2 && haulers.length >= 2) {
                plan.nextRun = Game.time + 69;
              }
            }
          } else if (!plan.active) {
            // why would I make the plan active?
            // - It has resources
            // - I am not mining power
            // - I need the resources
            console.log('excavation', plan.resource, hive.storage.store[plan.resource]);
            if (hive.storage && hive.storage.store[plan.resource] <= 1500 && hive.storage.store['energy'] >= 150000) {
              console.log('LOW');
              // plan.active = true;
            }

            plan.nextRun = Game.time + 1000;
          }
        }

        Memory.excavations[name] = plan;
      } else {
        if (!Memory.excavations) Memory.excavations = {};
        // first time excavating a room.
        // const room = Game.rooms[name];
        // if (room)
        // walkablePostitions = GameMap.
      }
    }
  },
}

roomSupport.excavationService = excavationService;
module.exports = roomSupport;
