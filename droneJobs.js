const lootPrio = ['power', 'X', 'LO', 'GO', 'KO', 'ZH', 'battery', 'O', 'H', 'L', 'U', 'K', 'Z', 'energy'];

function servicePowerSpawn(drone) {
	const room = drone.creep.room;
  const powerSpawn = Game.getObjectById(room.memory.powerSpawn.id);
  const storedPower = room.storage ? room.storage.store['power'] : 0;

  if (powerSpawn && storedPower > 0) {
  	const powerSpawnPower = powerSpawn.store['power'];
  	const powerNeeded = 100 - powerSpawnPower;

  	if (drone.creep.store['power'] > 0) {
    	if (powerSpawnPower <= 50) {
    		return { task: 'unload', target: powerSpawn.id, resource: 'power' };
    	} else {
    		return { task: 'unload', target: room.storage.id, resource: 'power' };
    	}
    } else if (powerSpawnPower <= 50 && drone.creep.store.getFreeCapacity('power') >= powerNeeded) {
    	return { task: 'load', target: room.storage.id, resource: 'power', amount: powerNeeded };
    } else if (drone.creep.store['energy'] > 0) {
    	return { task: 'unload', target: powerSpawn.id };
    } else if (drone.creep.store['energy'] === 0 && powerSpawn.store.getFreeCapacity('energy') >= drone.creep.store.getCapacity('energy')) {
      let targetStore = room.storage.id;
      const factory = room.getFactory();
      if (factory && factory.store['energy'] >= 11000) targetStore = factory.id;
      else if (room.terminal && room.terminal.store['energy'] >= 26000) targetStore = room.terminal.id;

      return { task: 'load', target: targetStore };
    }
  }
}

const jobs = {
  steward: function(drone) {
    const room = drone.creep.room;
    const travelTime = drone.get('travelTime');
    const isStandby = drone.isStandby();
    const taskController = room.taskController();

	  // takes care of all the things the room needs with higher efficiency than a hauler or drone
	  // Do I want to try to use the task controller here?
	  const spawnNeedsEnergy = room.energyAvailable / room.energyCapacityAvailable <= 0.85;
	  if (room.memory.mode === 'power' && spawnNeedsEnergy) {
	  	// OR room is full energygetMaintenanceTask
      // const terminal = drone.creep.room.terminal;
      // const targetStore = terminal && storage && terminal.store['energy'] >= storage.store['energy'] ? terminal : storage;
      // if (targetStore && targetStore.store.getUsedCapacity('energy') > freeCapacity ) {
      //   drone.setTask('load', targetStore.id);
      //   return;
    	// }
	  } else {
	  	// const task = taskController && taskController.servicePowerSpawn(drone);
	  	const task = servicePowerSpawn(drone);
	  	if (task) return drone.setTask(task);

	    // const lowEnergyTower = drone.getLowEnergyTower();
	    // if (lowEnergyTower) {
	    //   drone.setTask('unload', lowEnergyTower.id);
	    //   return;
	    // }
	  }

	  // a steward will act on the hives best interest
	},
  drone: function(drone) {
  	const room = drone.creep.room;
  	const spawn = drone.getSpawn();
    const controller = drone.controller;
    const source = drone.getSource();
    const storage = drone.getStorage();
    const targetRoom = drone.get('targetRoom');
    const taskController = room.taskController();

    // if I swap the order and use the task queue I can shift, but not resolve the duplicate task issue
	  if (targetRoom) {
	    if (drone.room.name === targetRoom) {
	      drone.moveTo(controller, { reusePath: 25 });
	      if (drone.isEnergyEmpty()) {
	        const droppedResource = source
	        	? source.pos.findInRange(FIND_DROPPED_RESOURCES, 2)
	        	: drone.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
	        if (droppedResource) {
	          drone.setTask('pickup', droppedResource.id);
	          return;
	        }

	        if (source) {
	          drone.setTask('harvest', source.id);
	          return;
	        }
	      } else {
	        const buildTargets = room.find(FIND_CONSTRUCTION_SITES);
	        if (buildTargets.length) {
	          drone.setTask('build', buildTargets[0].id);
	        } else {
	          drone.setTask('upgrade');
	        }
	      }

	    } else {
	      drone.moveToRoom(targetRoom);
	      return;
	    }
	  }

	  // storage less than half.
	  const storePercent = drone.getFreeCapacity('energy') / drone.creep.store.getCapacity('energy');
	  if (storePercent >= .50) {
	    // todo: Update drones to use the task queue to allow for more complex task assignment.
	    //    get energy => build, repair, chargeSpawn, chargeTower, chargeUpgrader, upgrade
	    //        -- I wonder if ideally this is done with a task queue ran by the hive somehow --
	    const storageEnergy = storage && storage.store.getUsedCapacity(RESOURCE_ENERGY);
	    const sourceMem = source && room && room.memory.sources && room.memory.sources[source.id];
	    const miner = !sourceMem || (sourceMem && sourceMem.miner && Game.creeps[sourceMem.miner]);
	    const salvage = drone.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
	      filter: tombstone => tombstone.store.getFreeCapacity(RESOURCE_ENERGY) !== tombstone.store.getCapacity(RESOURCE_ENERGY),
	    });

	    const nonEnergy = drone.hasResources();
	    if (nonEnergy && nonEnergy.length && storage) {
	      for (const resource in drone.creep.store) {
	        drone.pushTask({ name: 'unload', target: storage.id, resource: resource });
	      };
	      return;
	    }

	    // dumps energy from storage into the spawn
	    const lowRoomEnergy = room.energyAvailable < room.energyCapacityAvailable;
	    if (lowRoomEnergy && spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && storageEnergy > 20000) {
	      drone.setTask('load');
	      drone.setTarget(storage.id);
	      return;
	    }

	    if (salvage) {
	      let capacity = drone.getFreeCapacity();
	      for (const resource in salvage.store) {
	        if (salvage.store[resource] < capacity) {
	          capacity = capacity - salvage.store[resource];
	          drone.pushTask({ name: 'load', target: salvage.id, resource: resource });
	        }
	      }
	      return;
	    }

	    const container = drone.getEnergizedContainer(drone.getFreeCapacity());
	    if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > drone.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
	      drone.setTask('load', container.id);
	      return;
	    }

	    if (source && !miner) {
	      drone.setTask('harvest', source.id);
	      return;
	    }

	    const droppedResource = drone.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
	    if (droppedResource) {
	      drone.setTask('pickup', droppedResource.id);
        // drone.setTarget(droppedResource);
	      return;
	    }

	    // I'd like to make sure there is something to do.
	    if (drone.room.terminal && storage && drone.room.terminal.store['energy'] > storage.store.getUsedCapacity(RESOURCE_ENERGY)) {
	      drone.setTask('load');
	      drone.setTarget(drone.room.terminal.id);
	    } else if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 20000) {
	      // build targets are now in the room memory!
	      const buildTargets = room.find(FIND_CONSTRUCTION_SITES);
	      if (buildTargets && buildTargets.length || lowRoomEnergy) {
	        drone.setTask('load');
	        drone.setTarget(storage.id);
	        // drone.pushTask({ name: 'build' });
	        return;
	      }

	      return;
	    }
	  } else {
	    if (drone.isHome()) {
	      // const taskController = new TaskController(drone.creep.room);

	      // if (taskController.peekTasks()) {
	      //   let energyAvailable = drone.creep.store.getUsedCapacity(RESOURCE_ENERGY);

	      //   while (energyAvailable && taskController.peekTasks()) {
	      //     const task = taskController.peekTasks();
	      //     if (task.resource === RESOURCE_ENERGY && task.amount <= energyAvailable) {
	      //       drone.pushTask(taskController.getTask());
	      //       energyAvailable = energyAvailable - task.amount;
	      //     }
	      //   }
	      // }

	      // I am next to my container and it needs repair
	      if (source) {
	        const sourceMem = source && source.id && room && room.memory.sources && room.memory.sources[source.id];
	        const container = sourceMem && sourceMem.container && Game.getObjectById(sourceMem.container);
	        const repairAmount = drone.getUsedCapacity() * 100;
	        if (container && container.hits < 200000 && (container.hitsMax - container.hits > repairAmount)) {
	          drone.setTask('repair', container);
	          return;
	        }
	      }

	      const spawnOrExtension = drone.creep.pos.findClosestByPath(FIND_STRUCTURES, {
	        filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
	          || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
	      });
	      if (spawnOrExtension) {
	        drone.setTask('unload', spawn.store.getFreeCapacity(RESOURCE_ENERGY) >= 50 ? spawn.id : spawnOrExtension.id);
	        return;
	      }

	      if (taskController) {
	      	const task = taskController.getMaintenanceTask();
	      	if (task) return drone.setTask(task);
	      }

	      const lowEnergyTower = drone.getLowEnergyTower();
	      if (lowEnergyTower) {
	        return drone.setTask('unload', lowEnergyTower.id);
	      }

	      // power spawn
	      const powerSpawn = room.memory.powerSpawn && Game.getObjectById(room.memory.powerSpawn.id);
	      if (powerSpawn && powerSpawn.store['power'] > 0 && powerSpawn.store['energy'] <= 3500) {
	        return drone.setTask('unload', powerSpawn.id);
	      }
	      // const powerSpawn = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } }).onFirst(f => f);
	      // if (powerSpawn && powerSpawn.store['energy'] <= 3500) {
	      //   drone.setTask('unload', powerSpawn.id);
	      //   return;
	      // }

	      const upgradeContainer = room.memory.upgradeContainer && Game.getObjectById(room.memory.upgradeContainer);
	      if (upgradeContainer && upgradeContainer.store.getFreeCapacity(RESOURCE_ENERGY) >= drone.getUsedCapacity(RESOURCE_ENERGY)) {
	        return drone.setTask('unload', upgradeContainer.id);
	      } else if (room.controller.my && room.controller.level <= 5) {
	        return drone.setTask('upgrade');
	      }

	      // falls back on base unload target assignment
	      return drone.setTask('unload');
	    } else {
	    	const flag = drone.getFlag();
	      if (flag) {
	        if (flag.memory.task === 'harvest') {
	          return drone.setTask('moveTo', spawn);
	        } else if (flag.memory.task === 'build') {
	          const buildTargets = room.find(FIND_CONSTRUCTION_SITES);
	          if (buildTargets.length > 0) drone.setTask('build', buildTargets[0]);
	        }
	      } else {
	        // recharge?
	      }
	    }
	  }
	},
  upgrader: function(drone) {
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

    if (targetRoom && drone.room.name !== targetRoom) {
      drone.moveToRoom(targetRoom);
      return;
    }

    if (drone.memory.boosted && drone.creep.ticksToLive < 100) {
      const nearbyResource = drone.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 2).onFirst(f => f);
      if (nearbyResource) {
        drone.setTask('pickup', nearbyResource, 'yoink!');
        // better unload target..
        // the lab should be in memory... or maybe even global?
        const lab = Game.getObjectById(drone.memory.boosted);
        const targetStore = lab && lab.store.getFreeCapacity(nearbyResource) >= nearbyResource.amount ? lab.id : drone.getStorage().id;
        drone.pushTask({ name: 'unload', resource: nearbyResource.resourceType, target: targetStore });
      }
    }

    if (drone.isEnergyFull()) {
      drone.setTask('upgrade', null);
    } else {
    	const room = drone.creep.room;
      const controllerLink = room.memory.links && room.memory.links.controllerLink && Game.getObjectById(room.memory.links.controllerLink);
      const upgradeContainer = room.memory.upgradeContainer && Game.getObjectById(room.memory.upgradeContainer);

      if (controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        drone.setTask('load', controllerLink.id);
      } else if (upgradeContainer && upgradeContainer.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        drone.setTask('load', upgradeContainer.id);
      } else if (targetRoom) {
      	if ((drone.get('_nextDropSearch') || 0) <= Game.time) {
	        const energy = drone.room.controller.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: { resourceType: 'energy' }});
	        if (energy) {
	          drone.setTask('pickup', energy.id);
	          drone.moveTo(energy, { reusePath: 25 }); 
	        } else {
	        	drone.set('_nextDropSearch', Game.time + 17);
	        }
	      }
      }
    }
	},
  miner: function(drone) {
    const source = drone.getSource();
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

    // outer room mining operations
    if (targetRoom) {
      // if (drone.creep.ticksToLive <= 2) {
      //   if (Object.keys(drone.creep.store).length > 0) {
      //     // TODO: target the hauler with the least space
      //     const nearbyHauler = drone.creep.pos.findClosestByPath(FIND_MY_CREEPS, { filter: { memory: { job: 'hauler', targetRoom } } });
      //     if (nearbyHauler) {
      //       drone.setTask('unload', nearbyHauler);
      //       drone.set('resource', Object.keys(drone.creep.store)[0]);
      //     }
      //   }
      // }

      // travel to the indicated source
      if (drone.room.name === targetRoom) {
        if (!travelTime) {
        	drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        	if (source) drone.moveTo(source, { reusePath: 25 });
        }

        if (source && drone.canHarvest(source.depositType || source.mineralType)) {
          drone.setTask('harvest', source.id);
        } else {
        	if ((drone.get('_nextHaulerSearch') || 0) <= Game.time) {
	          const haulers = drone.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: { memory: { job: 'hauler', targetRoom } } })
		          .sort((a, b) => {
								return a.store.getFreeCapacity('energy') - b.store.getFreeCapacity('energy');
							});

	          if (haulers.length > 0 && haulers[0].store.getFreeCapacity() !== 0) {
	            drone.setTask('unload', haulers[0].id);
	            drone.set('resource', drone.getFirstResource());
	          } else {
	          	drone.set('_nextHaulerSearch', Game.time + 13);
	          }
	        }
        }
      } else {
      	drone.setTask('moveToRoom');
      }
      return;
    }
    
    const { link, container } = drone.getSourceStores();

    if (drone.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      let nearbyStores = drone.get('nearbyStores');
      if (nearbyStores) {
        nearbyStores = nearbyStores.map(id => Game.getObjectById(id));
      } else {
        nearbyStores = drone.creep.pos.findInRange(FIND_MY_STRUCTURES, 1);
        drone.set('nearbyStores', nearbyStores.map(s => s.id));
      }
      const nearbyEmptyStores = nearbyStores && nearbyStores.filter(structure => structure && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && ((link && structure.id !== link.id) || (container && structure.id !== container.id)));

      // I have energy
      if (nearbyEmptyStores.length > 0) {
        drone.setTask('unload', nearbyEmptyStores[0].id);
        return;
      } else if (link && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        drone.setTask('unload', link.id);
        return;
      } else if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        drone.setTask('unload', container.id);
        return;
      // } else if (container && container.hits < 200000 && (container.hitsMax - container.hits > drone.getUsedCapacity() * 100)) {
      //   drone.setTask('repair', container.id);
      //   return;
      } else {
        // note - miners could be updated to hold resources when the source is empty and the containers are full.
        if (source && source.mineralType) {
          drone.setTask('unload', drone.get('container') || drone.getStorage());
          drone.set('resource', source.mineralType);
        } else {
          // do I really want to drop stuff?
          if (!link) drone.setTask('drop');
        }
      }
    } else {
      // note: right-to-repair of the container was taken away with the removal of picking up energy
      // const nearbyResource = drone.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 2).onFirst(f => f);
      // if (nearbyResource && container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      //   drone.pickup(nearbyResource); // prevents decay when container is empty.
      // } else
      // I do not have energy
      if (source && (source.energy > 0 || source.mineralAmount > 0) && drone.canHarvest(source.depositType || source.mineralType)) {
        if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        drone.setTask('harvest', source.id, '🔄 harvest');
      } else if (source && source.mineralAmount === 0 && source.ticksToRegeneration >= drone.creep.ticksToLive) {
        drone.setTask('reclaim');
      }
      return;
    }
  },
  eHauler: function(drone) {
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

    if (targetRoom) {
      if (drone.isEmpty()) {
        drone.setTask('load', drone.get('energyStore'));
      } else if (drone.room.name === targetRoom) {
        if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        const targetStore = drone.creep.memory.targetStore && Game.getObjectById(drone.creep.memory.targetStore);
        if (targetStore && targetStore.store.getFreeCapacity('energy') > 0) {
          drone.setTask('unload', targetStore.id);
          return;
        }

        const target = drone.creep.pos.findClosestByRange(FIND_MY_CREEPS, { filter: { memory: { job: 'drone', homeRoom: drone.creep.memory.homeRoom } } });
        if (target && target.store.getFreeCapacity('energy') > 0) {
          drone.setTask('unload', target.id);
          return;
        } else {
          const lowEnergyTower = drone.getLowEnergyTower();
          if (lowEnergyTower) {
            drone.setTask('unload', lowEnergyTower.id);
            return;
          }

          if (drone.room.terminal) {
            drone.setTask('unload', drone.room.terminal.id);
          } else if (drone.room.memory.upgradeContainer) {
            drone.setTask('unload', drone.room.memory.upgradeContainer);
          } else if (drone.room.storage && drone.room.storage.store.getFreeCapacity('energy') > 10000) {
            drone.setTask('unload', drone.room.storage.id);
          }
          return;
        }

        if (drone.creep.store.length > 0 && drone.creep.ticksToLive <= travelTime * 2.1 && travelTime) {
          drone.set('homeRoom', targetRoom);
          drone.setTask('reclaim');
        }
      } else {
        // drone.moveToRoom(targetRoom);
        drone.setTask('moveToRoom');
      }
    }
	},
  'power-hauler': function(drone) {
    const storage = drone.getStorage();
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');
    const bankMem = drone.creep.memory.powerBank && Memory.powerBanks[drone.creep.memory.powerBank];

    if (targetRoom) {
	    if (drone.room.name === targetRoom) {
	      if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
	      // todo: I need to destroy myself if I can't make it back to spawn with power.
	      const bank = Game.getObjectById(drone.creep.memory.powerBank);
	      // I can guess the bank death time and wait till then
	      if (bank) {
	        if (!drone.creep.pos.inRangeTo(bank, 5)) {
	          drone.moveTo(bank, { reusePath: 25 });
	        } else {
	          drone.set('nextJobCheck', Game.time + 13);
	        }
	        return;
	      } else if (drone.getFreeCapacity('power') <= 0) {
	        drone.setTask('unload', storage.id);
	        drone.set('resource', 'power');
	        return;
	      } else {
	        drone.set('nextJobCheck', Game.time + 13);
	        const ruins = drone.room.find(FIND_RUINS, { filter: { resourceType: 'power' }});
	        const droppedResources = drone.room.find(FIND_DROPPED_RESOURCES, { filter: { resourceType: 'power' }});
	        const targets = [...ruins, ...droppedResources];

	        if (targets.length > 0) {
	          drone.moveTo(targets[0]);
	          drone.setTask('pickup', targets[0].id);
	          drone.set('resource', 'power');
	          drone.setTaskQueue([{ task: 'unload', target: storage.id, resource: 'power' }]);
	          drone.set('picked-up-power', true);
	        } else if (targets.length === 0) {
	          drone.moveTo(new RoomPosition(25, 25, targetRoom));
	          // I need better end of cycle code; I need to be sure I am not leaving in the gap
	          // If I ceate an indicator on the memory for when its cleaned up
	          if (drone.creep.store.getUsedCapacity('power') > 0) {
	            drone.setTask('unload', storage.id);
	            drone.set('resource', 'power');
	          } else if (drone.get('picked-up-power')) {
	          	if (drone.creep.ticksToLive >= 500) {
	          		drone.set('targetRoom', undefined);
	          		drone.setTask('moveToRoom');
	          	} else {
	          		drone.setTask('reclaim');
	          	}
	          	
	            // drone
	            if (bankMem) {
	              Memory.powerBanks[drone.creep.memory.powerBank] = undefined;
	            }
	          }
	        }
	        return;
	      }
	    } else {
	    	if (drone.creep.memory.powerBank && !bankMem) {
	    		if (drone.creep.ticksToLive >= 500) {
	      		drone.set('targetRoom', drone.get('homeRoom'));
	      		drone.set('job', 'steward');
	      		drone.setTask('moveToRoom');
	      	} else {
	      		drone.setTask('reclaim');
	      	}
	    	}

	      // drone.moveToRoom(targetRoom);
	      drone.setTask('moveToRoom');
	    }
    } else {
	  	const task = servicePowerSpawn(drone);
	  	if (task) return drone.setTask(task);
    }
  },
  hauler: function(drone) {
    const targetRoom = drone.get('targetRoom');
    const room = drone.creep.room;
    const source = drone.getSource();
    const spawn = drone.getSpawn();
    const storage = drone.getStorage();
    const freeCapacity = drone.creep.store.getFreeCapacity('energy');

    if (targetRoom) {
    	const travelTime = drone.get('travelTime');

    	// this is behavior I technically only want on external rooms, not when a hauler is assisting a room...
      if (drone.creep.ticksToLive <= travelTime * 1.50 && travelTime && storage) {
        const resource = drone.hasResources();
        if (resource) {
          drone.setTask('unload', storage.id);
          drone.set('resource', resource);
          drone.set('targetRoom', undefined);
        } else if (drone.creep.ticksToLive <= travelTime) {
          drone.creep.suicide();
        }
      }

      // travel to the indicated source
      if (room.name === targetRoom) {
        if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        if (drone.creep.memory.homeRoom === targetRoom) drone.set('targetRoom', undefined);

        const freeCapacity = drone.getFreeCapacity(RESOURCE_ENERGY);
        if (source && freeCapacity > 0) {
          const container = drone.get('container');
          if (container) {
            drone.setTask('load', container);
          }

          if ((drone.get('_nextSalvageSearch') || 0) <= Game.time) {
	          const salvage = drone.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
	            filter: tombstone => tombstone.store.getUsedCapacity(source.depositType) > 0,
	          });
	          if (salvage) {
	            let capacity = freeCapacity;
	            for (const resource in salvage.store) {
	              if (salvage.store[resource] < capacity) {
	                capacity = capacity - salvage.store[resource];
	                drone.pushTask({ name: 'load', target: salvage.id, resource: resource });
	              }
	            }
	            return;
	          }
	          drone.set('_nextSalvageSearch', Game.time + 69);
	        }

          if (!drone.creep.pos.inRangeTo(source, 2)) {
          	drone.moveTo(source);
          } else {
						drone.set('nextJobCheck', Game.time + 13);
          }
        }

        if (freeCapacity <= 25) {
          const targetStore = drone.get('targetStore') && Game.getObjectById(drone.get('targetStore'));
          const tar = targetStore && targetStore.store.getFreeCapacity(RESOURCE_ENERGY) > drone.getUsedCapacity()
            ? targetStore.id
            : storage && storage.id;
            if (tar) {
		          drone.setTask('unload', tar);
		          drone.set('resource', drone.hasResources());	
            }
        }
      } else {
        drone.setTask('moveToRoom');
      }
      return;
    }

    if (drone.isEmpty()) {
      if (source) {
        const sourceMem = source.id && room.memory.sources && room.memory.sources[source.id];
        const droppedResources = source.pos.findInRange(FIND_DROPPED_RESOURCES, 2, {
          filter: (resource) => resource.amount >= 50,
        });

        if (droppedResources && droppedResources.length) {
          drone.setTask('pickup', droppedResources[0].id);
        } else if (sourceMem && sourceMem.container) {
          drone.setTask('load', sourceMem.container);
          return;
        }
      } else {
        // check if the factory happens to have a ton of energy
        const factory = room.getFactory();
        if (factory && factory.store['energy'] >= 11000) {
          drone.setTask('load', factory.id);
          return;
        }

        const links = spawn && spawn.room.memory.links;
        const mainLink = links && links.mainLink && Game.getObjectById(links.mainLink);
        if (mainLink && mainLink.store.getUsedCapacity(RESOURCE_ENERGY) > 400) {
          drone.setTask('load', mainLink);
          return;
        }

        if ((drone.get('_nextDropSearch') || 0) <= Game.time) {
        	const droppedResource = drone.findClosestDroppedResource();
          if (droppedResource) {
            return drone.setTask('pickup', droppedResource);
          }
        	drone.set('_nextDropSearch', Game.time + 11);
        }

        const energizedContainer = drone.getEnergizedContainer(freeCapacity);
        if (energizedContainer) {
          drone.setTask('load', energizedContainer);
          return;
        }

        if (storage && room.memory.mineral) {
          const mineral = room.memory.mineral.id && Game.getObjectById(room.memory.mineral.id);
          const mineralContainer = room.memory.mineral.container && Game.getObjectById(room.memory.mineral.container);

          if (mineralContainer && mineralContainer.store[mineral.mineralType] >= freeCapacity) {
            drone.setTask('load', mineralContainer.id);
            drone.set('resource', mineral.mineralType);
            drone.pushTask({ name: 'unload', target: storage.id, resource: mineral.mineralType });
            return;
          } else if (mineralContainer && mineralContainer.store['energy'] >= freeCapacity) {
            drone.setTask('load', mineralContainer.id);
            return;
          }
        }

        const spawnNeedsEnergy = spawn && spawn.room.energyAvailable / spawn.room.energyCapacityAvailable <= 0.85;
        if (spawnNeedsEnergy) {
          const terminal = drone.creep.room.terminal;
          const targetStore = terminal && storage && terminal.store['energy'] >= storage.store['energy'] ? terminal : storage;
          if (targetStore && targetStore.store.getUsedCapacity('energy') > freeCapacity ) {
            drone.setTask('load', targetStore.id);
            return;
          }
        }

				const taskController = room.taskController();
        if (taskController) {
          const labTask = taskController.getLabTask();
          if (labTask) return drone.setTaskQueue(labTask);
        }
      }

      // all haulers search
      if (!room.memory.encounter && (drone.get('_nextSalvageSearch') || 0) <= Game.time) {
        const salvage = drone.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
          filter: salvage => salvage.store.getUsedCapacity() > 0,
        });

        if (salvage) {
          let capacity = freeCapacity;
          for (const resource in salvage.store) {
            if (salvage.store[resource] < capacity) {
              capacity = capacity - salvage.store[resource];
              drone.pushTask({ name: 'load', target: salvage.id, resource: resource });
            }
          }

          let targetStore = storage;
          if (targetStore) drone.pushTask({ name: 'unload', target: targetStore.id });
          return;
        } else {
        	drone.set('_nextSalvageSearch', Game.time + 69);
        }
      }

      if ((drone.get('_nextRuinSearch') || 0) <= Game.time) {
        const ruin = drone.creep.pos.findClosestByPath(FIND_RUINS, {
          filter: ruin => ruin.store.getUsedCapacity() > 0,
        });
        if (ruin) return drone.setTask('load', ruin);
        else drone.set('_nextRuinSearch', Game.time + 269);
      }

      // low energy tower
      if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 20000) {              
        const lowEnergyTower = drone.getLowEnergyTower();
        if (lowEnergyTower) {
          drone.setTask('load', storage);
          drone.pushTask({ name: 'unload', target: lowEnergyTower.id });
          return;
        }
      }

      // const roomMem = drone.get('homeRoom') && Memory.rooms[drone.get('homeRoom')];
      // if (roomMem && roomMem.unloadRequest) {
      //   // something has requested to be unloaded
      //   drone.setTask('load', roomMem.unloadRequest);
      //   Memory.rooms[drone.get('homeRoom')].unloadRequest = undefined;
      // }

      drone.set('nextJobCheck', Game.time + 11);
    } else {
      // todo: task controller getEnergy
      // unloading logic
      const resource = drone.hasResources();
      if (drone.isEnergyEmpty() && resource && resource !== 'energy') {
        drone.setTask('unload');
        drone.set('resource', resource);

        if (storage.store.getFreeCapacity(resource) >= 1000) {
          drone.setTarget(storage.id);
        }
        // else if (drone.room.terminal && drone.room.terminal.store.getFreeCapacity(resources[0]) >= 1000) {
        //   drone.setTarget(drone.room.terminal.id);
        // }
      }

      drone.setTask('unload');
      // where should it go??
    }
  },
  keeper: function(drone) {
    const targetRoom = drone.get('targetRoom');

	  if (targetRoom) {
    	const source = drone.getSource();

      if (drone.room.name === targetRoom) {
      	const travelTime = drone.get('travelTime');
        if (!travelTime) {
        	if (source) drone.moveTo(source);
        	drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        }

        const container = drone.creep.memory.container ? Game.getObjectById(drone.creep.memory.container) : (() => {
          const container = source.pos.findInRange(FIND_STRUCTURES, 2, { filter: { structureType: STRUCTURE_CONTAINER }}).first();
          if (container) drone.creep.memory.container = container.id;
          return container;
        })();

        if (drone.canHarvest()) {
          if (!container && drone.creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1).first()) {
            drone.setTask('pickup');
            return;
          }
          drone.setTask('harvest', source.id);
          return;
        } else {
          if (container) {
            if (container.hits < 200000) {
              drone.setTask('repair', container.id);
            } else if (container.store.getFreeCapacity('energy') !== 0) {
              drone.setTask('unload', container.id);
              drone.set('resource', drone.getFirstResource());
            } else {
            	if ((drone.get('_nextRepairCheck') || 0) <= Game.time) {
                const repairTargets = drone.room.find(FIND_STRUCTURES, {
                  filter: (struct) => struct.structureType === STRUCTURE_ROAD && (struct.hitsMax - struct.hits) >= 1200
                });
                if (repairTargets.length > 0) {
                  drone.setTask('repair', repairTargets[0].id);
                } else {
                	drone.set('_nextRepairCheck', Game.time + 100);
                }
              }
            }
          } else {
            const buildTargets = drone.creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 3);
            if (buildTargets.length > 0) {
              drone.setTask('build', buildTargets[0]);
              return;
            }

            const haulers = drone.creep.pos.findInRange(FIND_MY_CREEPS, 3, { filter: { memory: { job: 'hauler', targetRoom } } })
              .sort((a, b) => {
                return a.store.getFreeCapacity('energy') - b.store.getFreeCapacity('energy');
              });
            if (haulers.length > 0 && haulers[0].store.getFreeCapacity() !== 0) {
              drone.setTask('unload', haulers[0].id);
              drone.set('resource', drone.getFirstResource());
              return;
            }
          }
          drone.set('nextJobCheck', Game.time + 10);
        }
      } else {
        if (source) drone.moveTo(source);
        drone.moveToRoom(targetRoom);
        drone.setTask('moveToRoom');
      }
      return;
    }
  },
  builder: function(drone) {
  	// todo: update builders to allow for setting a target room.
    const targetRoom = drone.get('targetRoom');

    if (drone.isHome()) {
      if (drone.isEmpty()) {
        const storage = drone.getStorage();
        const terminal = drone.room.terminal;

        // default minimum tends to be 25k
        if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= 25000) {
          drone.setTask('load', terminal.id);
        } else if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
          drone.setTask('load', storage.id);
        } else {
          const container = drone.getEnergizedContainer(drone.getFreeCapacity());
          if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > drone.creep.store.getFreeCapacity(RESOURCE_ENERGY)) {
            return drone.setTask('load', container.id);
          }

          if ((drone.get('_nextHostileSearch') || 0) <= Game.time) {
	          const droppedResources = drone.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
	          if (droppedResources) {
	            return drone.setTask('pickup');
	          } else {
	          	drone.set('_nextHostileSearch', Game.time + 11);
	          }
	        }
        }
      } else {
      	const taskController = drone.room.taskController();

      	if (taskController) {
      		const task = taskController.getMaintenanceTask();
      		if (task) return drone.setTask(task);
      	}
      }
    }
	},
  power: function(drone) {
    if (drone.isHome()) {
      const powerSpawn = Game.getObjectById(drone.room.memory.powerSpawn.id);
      if (powerSpawn) {
        if (drone.isEmpty()) {
          const storage = drone.getStorage();
          // temporary clean up code
          if (drone.room.find(FIND_MY_CREEPS, { filter: { memory: { job: 'power' } } }).length > 2) {
            drone.creep.suicide();
            return;
          }

          const spawnPower = powerSpawn.store['power'];
          if (spawnPower <= 50 && storage.store['power'] > 0) {
            drone.setTask('load', storage.id);
            drone.set('resource', 'power');
            drone.set('amount', 100 - spawnPower);
          } else if (powerSpawn.store['energy'] < 1000 && storage.store['energy'] >= 50) {
            drone.setTask('load', storage.id);
          } else if (storage.store['power'] <= 0) {
            drone.setTask('reclaim');
          }
        } else {
          const resource = drone.hasResources();
          drone.setTask('unload', powerSpawn.id);
          drone.set('resource', resource);
        }
      }
    }
  },
  bankRam: function(drone) {
    const targetRoom = drone.get('targetRoom');
    if (targetRoom) {
      if (drone.room.name === targetRoom) {
    		const travelTime = drone.get('travelTime');
        if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        if (drone.creep.memory.powerBank) {
          const pb = Game.getObjectById(drone.creep.memory.powerBank);
          if (pb) {
            drone.setTask('power-attack', drone.creep.memory.powerBank);
            drone.moveTo(pb);
          } else {
            // I can search for a new powerbank or be reassigned.
            drone.creep.memory.powerBank = null;
          }
        } else {
          // move back home and look for things to attack!
          // drone.moveToRoom(drone.get('homeRoom'));
          // if (drone.creep.room.name === drone.get('homeRoom')) {
          //   drone.setTask('reclaim');
          // }
          drone.findNewBankOrReclaim();
        }
      } else {
        // drone.moveToRoom(targetRoom);
        drone.setTask('moveToRoom');
      }
    }
  },
  bankTank: function(drone) {
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

    if (drone.room.name === targetRoom) {
      if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
      if (drone.creep.memory.powerBank) {
        const pb = Game.getObjectById(drone.creep.memory.powerBank);
        if (pb) {
          drone.setTask('power-range-attack', drone.creep.memory.powerBank);
          drone.moveTo(pb);
        } else {
          // I can search for a new powerbank or be reassigned.
          drone.creep.memory.powerBank = null;
        }
      } else {
        // move back home and look for things to attack!
        drone.moveToRoom(drone.get('homeRoom'));
        const powerBank = drone.creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK} });
        if (powerBank) {
          drone.set('powerBank', powerBank.id);
        }

        if (drone.room.name === drone.get('homeRoom')) {
          drone.setTask('reclaim');
        }
      }
    } else {
      drone.moveToRoom(targetRoom);
    }
	},
  soldier: function(drone) {
    const targetRoom = drone.get('targetRoom');
	  if (targetRoom) {
	    if (drone.room.name === targetRoom) {
	      if (drone.creep.memory.target && drone.creep.pos.isNearTo(Game.getObjectById(drone.creep.memory.target))) {
	        drone.setTask('attack', drone.creep.memory.target);
	      } else if (!drone.creep.memory.target) {
	        drone.setTask('siege');
	      } else if (Game.getObjectById(drone.creep.memory.target)) {
	        drone.moveTo(drone.creep.memory.target);
	      }
	      return;
	    } else {
	      drone.setTask('moveToRoom');
	      // drone.moveToRoom(targetRoom);
	      return;
	    }
	  }

	  // identify hostiles
	  if ((drone.get('_nextHostileSearch') || 0) <= Game.time) {
		  const hostileHealer = drone.creep.room.find(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(HEAL) > 0 });
		  const closestHostile = drone.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
		    filter: (creep) => creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0,
		  });
		  const flagbearer = drone.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(CLAIM) > 0 });
		  let tar = hostileHealer[0] || closestHostile || flagbearer;
		  if (tar) {
		    drone.setTask('attack', tar.id);
	  	} else {
      	drone.set('_nextHostileSearch', Game.time + 33);
      }
    }
	},
  gunship: function(drone) {
    const targetRoom = drone.get('targetRoom');
    let target;

    if (targetRoom) {
      if (drone.room.name === targetRoom) {
        if (drone.creep.memory.target) {
          target = Game.getObjectById(drone.creep.memory.target);
          if (target) {
            drone.rangedAttack(target);
          }
        }
      } else {
        drone.setTask('moveToRoom');
      }

      // identify hostiles
      if ((drone.get('_nextHostileSearch') || 0) <= Game.time) {
	      const hostileHealer = drone.room.find(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(HEAL) > 0 });
	      const closestHostile = drone.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
	        filter: (creep) => creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0,
	      });
	      const flagbearer = drone.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(CLAIM) > 0 });
	      const invaderCore = drone.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } }).first();
	      let tar = hostileHealer[0] || closestHostile || flagbearer || invaderCore;
	      if (tar) {
	        drone.setTask('range-attack', tar.id);
	      } else {
	      	drone.set('_nextHostileSearch', Game.time + 33);
	      }
	    }
    }
	},
  ranger: function(drone) {
    const flag = drone.getFlag();
    const targetRoom = drone.get('targetRoom');
    let target;

    if (flag) {
      if (drone.creep.pos.inRangeTo(flag, 5)) {
        const nearbyEnemies = flag.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
        if (nearbyEnemies[0]) {
          drone.setTask('range-attack', nearbyEnemies[0]);
          return;
        } else {
        	const source = drone.getSource();
          if (source && !source.pos.inRangeTo(target, 3)) {
            drone.moveTo(source)
          }
        }
      } else {
        drone.moveTo(flag, config.moveToOpts);
      }
    } else if (targetRoom) {
      if (drone.creep.room.name === targetRoom) {
        if (drone.creep.hitsMax - drone.creep.hits >= 150) {
          drone.creep.heal(drone.creep);
        } else if (drone.creep.memory.target) {
          target = Game.getObjectById(drone.creep.memory.target);
          if (target) {
            drone.rangedAttack(target);
          }
        }
        // I should heal criticaly damaged allies
      } else {
        // drone.moveToRoom(targetRoom);
        drone.setTask('moveToRoom');
      }
      return;
    }

    // no flag or target room, act as a defender
    const hostileHealer = drone.creep.room.find(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(HEAL) > 0 });
    const closestHostile = drone.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
      filter: (creep) => creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0,
    });
    const flagbearer = drone.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: (creep) => creep.getActiveBodyparts(CLAIM) > 0 });
    let tar = hostileHealer[0] || closestHostile || flagbearer;
    if (tar) {
      drone.setTask('range-attack', tar.id);
    };
	},
	'power-healer': function(drone) {
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');
	},
  healer: function(drone) {
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');
    const flag = drone.getFlag();
    let target;

    if (flag) {
      if (drone.creep.pos.inRangeTo(flag, 5)) {
        drone.setTask('heal');
      } else {
        drone.moveTo(flag, config.moveToOpts);
      }
    } else if (targetRoom) {
      if (drone.room.name === targetRoom) {
        if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        const powerBank = drone.creep.memory.powerBank && Game.getObjectById(drone.creep.memory.powerBank);
        if (powerBank && drone.creep.pos.inRangeTo(powerBank, 5)) {
          drone.setTask('power-heal');
          drone.set('target', null);
        } else {
          drone.moveTo(powerBank);
        }

        if (drone.creep.memory.powerBank && !powerBank) {
          drone.findNewBankOrReclaim()
        }
      } else {
        // drone.setTask('moveToRoom', targetRoom);
        // drone.moveToRoom(targetRoom);
        drone.setTask('moveToRoom');
      }
    }

    if (drone.creep.hits / drone.creep.hitsMax <= 0.9) {
      drone.creep.heal(drone.creep.id);
    }
	},
  pirate: function(drone) {
    const targetRoom = drone.get('targetRoom');

	  if (targetRoom) {
	    // I want to wait occasionally..
	    if (drone.room.name === targetRoom) {
	      drone.creep.moveTo(drone.room.controller);
	      // a high cpu cost unit that interupts and steals from minig operations
	      if (drone.getFreeCapacity('energy') > 0) {
	        const droppedResource = drone.creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
	        const salvage = drone.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
	          filter: tombstone => global.hasKeys(tombstone.store),
	        });
	        const rangeToResource = droppedResource ? drone.creep.pos.getRangeTo(droppedResource) : Infinity;
	        const rangeToSalvage = salvage ? drone.creep.pos.getRangeTo(salvage) : Infinity;

	        if (salvage && salvage < rangeToResource) {
	          drone.setTask('load', salvage.id);
	          return;
	        }

	        const enemyHauler = drone.creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {
	          filter: (creep) => !creep.getActiveBodyparts(WORK) && (global.hasKeys(creep.store) || creep.hits <= 100),
	        });
	        const rangeToHauler = enemyHauler ? drone.creep.pos.getRangeTo(enemyHauler) : Infinity;

	        if (rangeToResource < rangeToHauler) {
	          drone.setTask('pickup', droppedResource.id);
	          return;
	        } else if (enemyHauler) {
	          drone.setTask('range-attack', enemyHauler.id);
	          // drone.rangedAttack(enemyHauler, 1, 0);
	          return;
	        }

	        // what if there is nothing to do, I can check another room!
	        const patrolPath = drone.creep.memory.patrolPath;
	        if (patrolPath && drone.creep.memory.patrolIndex) {
	          const nextIndex = (drone.creep.memory.patrolIndex + 1) % patrolPath.length;
	          drone.creep.memory.targetRoom = patrolPath[nextIndex];
	          drone.creep.memory.patrolIndex = nextIndex;
	        }
	      } else {
	        // bring the energy home
	        // drone.creep.say('nwo aht?')
	        // drone.moveToRoom(drone.get('hoomRoom'));
	        drone.setTask('unload');
	      }
	    } else {
	      if (drone.isEmpty()) {
	        drone.moveToRoom(targetRoom); 
	      } else {
	        const homeRoom = drone.getHomeRoom();
	        drone.setTask('unload', homeRoom.storage ? homeRoom.storage.id : null);
	      }
	    }
	  }
	},
  sweeper: function(drone) {
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

	  if (targetRoom) {
	    if (drone.room.name === targetRoom) {
	      if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
	      drone.creep.moveTo(drone.room.controller);

	      if (drone.getFreeCapacity('energy') > 0) {
	        let enemyStorage = drone.room.storage;
	        let enemyTerminal = drone.room.terminal;
	        if (enemyStorage || enemyTerminal) {
	          let foundResource = false;
	          for (const resource of lootPrio) {
	            if (enemyTerminal && enemyTerminal.store[resource]) {
	              drone.setTask('load', enemyTerminal.id);
	              drone.set('resource', resource);
	              foundResource = true;
	              return;
	            }
	            if (enemyStorage && enemyStorage.store[resource]) {
	              drone.setTask('load', enemyStorage.id);
	              drone.set('resource', resource);
	              foundResource = true;
	              return;
	            }
	          }

	          if (foundResource) return;
	          if (Memory.lootables && Memory.lootables[drone.room.name]) {
	          	Memory.lootables[drone.room.name] = undefined;
	          }
	        }

	        const droppedResource = drone.creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: (resource) => resource.amount > 15 });
	        const salvage = drone.creep.pos.findClosestByPath(FIND_TOMBSTONES, {
	          filter: tombstone => global.hasKeys(tombstone.store),
	        });
	        const rangeToResource = droppedResource ? drone.creep.pos.getRangeTo(droppedResource) : Infinity;
	        const rangeToSalvage = salvage ? drone.creep.pos.getRangeTo(salvage) : Infinity;

	        if (droppedResource && rangeToResource < rangeToSalvage) {
	          drone.setTask('pickup', droppedResource.id);
	          return;
	        } else if (salvage) {
	          drone.setTask('load', salvage.id);
	          return;
	        }

	        const ruin = drone.creep.pos.findClosestByRange(FIND_RUINS, {
	          filter: ruin => ruin.store.getUsedCapacity() > 0,
	        });
	        if (ruin) {
	          drone.setTask('load', ruin.id);
	          drone.set('resource', Object.keys(ruin.store)[0]);
	          return;
	        }

	        drone.set('nextJobCheck', Game.time + 11);
	      } else {
	        const homeRoom = drone.getHomeRoom();
	        drone.setTask('unload', homeRoom.storage ? homeRoom.storage.id : null);
	      }
	    } else {
	      if (drone.isEmpty()) {
	        if (!travelTime || drone.creep.ticksToLive >= travelTime * 1.9) {
	          drone.moveToRoom(targetRoom);
	        } else {
	          drone.creep.say('running out of time!');
	          drone.setTask('reclaim');
	        }
	      } else {
	        const homeRoom = drone.getHomeRoom();
	        drone.setTask('unload', homeRoom.storage ? homeRoom.storage.id : null);
	        drone.set('resource', drone.getFirstResource());
	      }
	    }
	  }
	},
  interupter: function(drone) {
    const targetRoom = drone.get('targetRoom');
    if (drone.room.name === targetRoom) {
    	const controller = drone.room.controller;
      const ambushPos = drone.get('ambushPos') || (controller && controller.pos);
      drone.moveTo(ambushPos);

      if (Game.time % 10) {
        // If im in the middle, it's fine if I let them approach me
        const enemyHauler = drone.creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {
          filter: (creep) => !creep.getActiveBodyparts(WORK),
        });

        if (enemyHauler) {
          drone.setTask('range-attack', enemyHauler.id);
          return;
        }
      }
    } else {
      drone.moveToRoom(targetRoom); 
    }
	},
  'mineral-hauler': function(drone) {
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');
    const eol = travelTime && drone.creep.ticksToLive < travelTime * 1.15;

    if (drone.room.name === targetRoom) {
      if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
      const lair = Game.getObjectById(drone.creep.memory.lair);
      const mineral = drone.getSource();

      if (mineral) {
        const mineralAmount = drone.creep.store[mineral.mineralType];
        const avoidLairSpawn = lair && lair.ticksToSpawn < 15 && mineralAmount > 400;
        const mineralDepleted = mineral.mineralAmount === 0;
        if ((avoidLairSpawn || eol) || (mineralDepleted && mineralAmount > 0) || drone.getFreeCapacity() <= 0) {
        	const storage = drone.getStorage();
          drone.setTask('unload', storage.id);
          drone.set('resource', mineral.mineralType);
          return;
        }

        const droppedResources = drone.creep.room.find(FIND_DROPPED_RESOURCES, { filter: { resourceType: mineral.mineralType }});
        if (droppedResources.length > 0) {
          drone.moveTo(droppedResources[0]);
          drone.setTask('pickup', droppedResources[0].id);
          drone.set('resource', mineral.mineralType);
        }

        const hangoutSpot = drone.get('miningPosition') || mineral.pos;
        if (!drone.creep.pos.inRangeTo(hangoutSpot, 2)) {
          drone.moveTo(hangoutSpot);
        } else {
          drone.set('nextJobCheck', Game.time + 7);
        }
        return;
      }
    } else {
      if (eol) {
        drone.setTask('reclaim');
        return;
      }
      if (drone.isEmpty()) {
        drone.moveToRoom(targetRoom); 
      } else {
        const homeRoom = drone.getHomeRoom();
        drone.setTask('unload', homeRoom.storage ? homeRoom.storage.id : null);
      }
    }
	},
  excavator: function(drone) {
    const flag = drone.getFlag();
    const source = drone.getSource();
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

    // mines minerals in dangerous rooms
    if (drone.room.name === targetRoom) {
      if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
      const miningPosition = drone.get('miningPosition');
      if (miningPosition) drone.moveTo(miningPosition);

      // I need to play keep away from enemies
      // introduce squad code that checks the timer and updates when the enemy is alive!

      // I should have the 
      const excavationPlan = Memory.excavations[targetRoom];
      const enemyKeeper = excavationPlan.enemyKeeper && Game.getObjectById(excavationPlan.enemyKeeper);
      if (enemyKeeper) {
        drone.creep.say('running');
        drone.moveAway(enemyKeeper);
        return;
      }

      if (drone.canHarvest(source.mineralType) && source.mineralAmount) {
        drone.setTask('harvest', source.id);
      } else {
        const haulers = drone.creep.pos.findInRange(FIND_MY_CREEPS, 2, { filter: { memory: { job: 'mineral-hauler', targetRoom } } })
          .sort((a, b) => {
            return a.store.getFreeCapacity('energy') - b.store.getFreeCapacity('energy');
          });

        if (haulers.length > 0 && haulers[0].store.getFreeCapacity() !== 0) {
          drone.setTask('unload', haulers[0].id);
          drone.set('resource', drone.getFirstResource());
          return;
        }
        drone.set('nextJobCheck', Game.time + 7);
      }
    } else {
      drone.setTask('moveToRoom');
    }
	},
  'anti-keeper': function(drone) {
    const source = drone.getSource();
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

    if (targetRoom) {
      if (drone.room.name === targetRoom) {
        if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        if (drone.hitPercentage < 0.65) {
          drone.creep.heal(drone.creep);
          return;
        }

        const excavationPlan = Memory.excavations[targetRoom];
        let enemyKeeper = excavationPlan.enemyKeeper && Game.getObjectById(excavationPlan.enemyKeeper);
        if (!enemyKeeper) enemyKeeper = source.pos.findInRange(FIND_HOSTILE_CREEPS, 7).first();

        if (enemyKeeper) {
          if (!excavationPlan.keeper) excavationPlan.keeper = enemyKeeper.id;
          drone.moveTo(enemyKeeper);
          drone.setTask('range-attack', enemyKeeper.id)
          const range = drone.creep.pos.getRangeTo(enemyKeeper);
          return;
        } else {
          const lair = drone.creep.memory.lair && Game.getObjectById(drone.creep.memory.lair);
          if (excavationPlan.keeper) excavationPlan.keeper = null;
          if (lair && !drone.creep.pos.inRangeTo(lair, 2)) {
            drone.moveTo(lair)
            return;
          }

          if (drone.creep.hitsMax !== drone.creep.hits) {
            drone.creep.heal(drone.creep);
            return;
          } else {
            // search for damaged creeps
            const woundedCreeps = drone.creep.pos.findInRange(FIND_MY_CREEPS, 7, { filter: creep => creep.hits < creep.hitsMax })
              .sort((a, b) => a.hits > b.hits);
            if (woundedCreeps.length > 0) {
              drone.setTask('heal', woundedCreeps[0].id);
              return;
            }

            drone.set('nextJobCheck', Game.time + lair.ticksToSpawn);
          }
        }
      } else {
        drone.moveToRoom(targetRoom);
        // drone.setTask('moveToRoom');
      }
      return;
    }
	},
  scout: function(drone) {
    const room = drone.creep.room;
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');

    // scouts can have different tasks like keeping a room 
    // scout halls - Move to the nearest hallway and go towards the corner
    // - notes the rooms with resources in them in memory, with how long they are expected to exist.
    // - goes through portal?
    // 
    // The scout targets the nearest corner. W0N50 ->
    const mode = drone.get('mode');

    if (targetRoom) {
      if (drone.room.name === targetRoom) {
        if (!travelTime) drone.set('travelTime', 1500 - drone.creep.ticksToLive);
        if (drone.room.controller) drone.moveTo(drone.room.controller || { x: 25, y: 25 });
				if ((drone.get('_nextScan') || 0) <= Game.time) {
					drone.set('_nextScan', Game.time + 11);
	        if (mode === 'scan-halls') {
	          // const nearestHall = GameMap.findNearestHallway(drone.creep.room.name);
	        } else if (mode === 'scan-portals') {
	        	const data = GameMap.scan(drone.creep.room.name);

	        	if (data.portals && data.portals.length > 0) {
	        		for (const portal of data.portals) {
	        			if (portal.destination.shard !== drone.get('homeShard')) {
	        				// console.log('portal', data.portals[0]);
	        				return drone.usePortal(portal);		
	        			}
	        		}

				    	const nearestCrossroad = GameMap.findNearestCrossroad(drone.creep.room.name);
				    	drone.set('targetRoom', nearestCrossroad);	
	        	}
	        }
        }
      } else {
      	drone.setTask('moveToRoom');
        // drone.moveToRoom(targetRoom);
      }
      return;
    } else {
    	// nowhere to go... find the nearest corner room.
    	const nearestCrossroad = GameMap.findNearestCrossroad(drone.creep.room.name);
    	drone.set('targetRoom', nearestCrossroad);
    	if (!drone.memory.mode) drone.set('mode', 'scan-portals');
    }
	},
  battleRam: function(drone) {
    const targetRoom = drone.get('targetRoom');

    if (drone.room.name === targetRoom) {
      const targets = drone.get('targets') || [];
      if (targets.length > 0) {              
        const target = targets.shift();
        drone.moveTo(target);
        drone.setTask('dismantle', target);
        drone.set('targets', targets);
      } else {
        const myPos = drone.creep.pos;
        const tower = myPos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });

        if (tower) {
          drone.setTask('dismantle', tower.id);
          return;
        }

        const extension = myPos.findClosestByRange(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
        if (extension) {
          drone.setTask('dismantle', extension.id);
          return;
        }

        drone.set('nextJobCheck', Game.time + 13);
      }
    } else {
      drone.setTask('moveToRoom');
    }
	},
  sapper: function(drone) {
    const targetRoom = drone.get('targetRoom');

    // Spawn6.createDrone('sapper', [...m10, ...m10, ...h10, ...h10], {targetRoom:'E6N55',invaderCore:'6989b3a959464da190dc37af'})
    if (drone.room.name === targetRoom) {
      if (drone.creep.hits !== drone.creep.hitsMax) {
        drone.creep.heal(drone.creep);
        drone.moveToRoom(drone.get('homeRoom'));
      }
    } else if (drone.creep.hits === drone.creep.hitsMax) {
      drone.moveToRoom(targetRoom);
    } else if (drone.creep.hits !== drone.creep.hitsMax) {
      drone.creep.heal(drone.creep);
      drone.moveToRoom(targetRoom);
    }
	},
  flagbearer: function(drone) {
    const flag = drone.getFlag();
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');
    let target;

    if (flag) {
      const distanceToFlag = drone.pos.getRangeTo(flag);
      if (flag.pos.roomName === drone.room.name) {
        if (!travelTime) {
        	drone.set('travelTime', 750 - drone.creep.ticksToLive);
        	drone.moveTo(targetController, config.moveToOpts);
        }

        const targetController = drone.room.controller;
        if (targetController.owner && targetController.owner.username !== Game.username) {
          drone.setTask('attackController');
        } else if (!targetController.reservation) {
          drone.setTask('claim');
        }
      } else {
        drone.moveToRoom(flag.pos.roomName);
      }
      return;
    }

    if (drone.room.name === targetRoom) {
      const controller = drone.room.controller;
      if (drone.creep.pos.isNearTo(controller)) {
        if (flag || drone.get('claim')) {
          drone.setTask('claim');
        } else if (controller.reservation && controller.reservation.username === 'Invader') {
          // drone.setTask('attackController');
          drone.creep.attackController(controller);
        } else {
          drone.setTask('reserve');
        }
      } else {
        drone.moveTo(controller, { reusePath: 25 });
      }
    } else {
      // drone.moveToRoom(targetRoom);
      drone.setTask('moveToRoom');
    }
	},
  quadling: function(drone) {
    const flag = drone.getFlag();
    const targetRoom = drone.get('targetRoom');
    const travelTime = drone.get('travelTime');
    let target;

    // a quadling waits for the squad to be ready and heads to the target room
    // it needs to operate 
    // quads really shou
    if (drone.room.name === targetRoom) {
      let creeps;
      const squad = global.squads[targetRoom];
      // if (squad && squad.length > 0) creeps = squad;
      if (drone.creep.hits !== drone.creep.hitsMax) {
        drone.creep.heal(drone.creep);
        // drone.moveToRoom(drone.get('homeRoom'));
      }
    } else {
      drone.moveToRoom(targetRoom);
    }
  },
}

module.exports = jobs;
