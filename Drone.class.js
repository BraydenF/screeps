const BaseCreep = require('Creep.class');
const config = require('config');

const { INITIAL_SPAWN, JOBS, DRONE_LIMIT, MODES } = config;

/**
 * Drones perform `tasks` based on the assigned `job`
 * Drones keep themselves alive by going to the spawner for repairs at 350 ticksToLive
 */
class Drone extends BaseCreep {
  static getDrones(job) {
    const drones = [];
    for(const name in Game.creeps) {
      const creep = Game.creeps[name];

      if (creep.memory.role === 'drone') {
        if (job) { // only displays drones of job
          if (creep.memory.job === job) {
              drones.push(new Drone(creep));
          }
        } else { // displays all drones
          drones.push(new Drone(creep));
        }
      }
    }

    return drones;
  }

  constructor(creep, job) {
    if (!creep) {
        throw new Error('Must supply a creep');
    }

  	super(creep);
    const memory = creep.memory || {};
    const sources = creep.room.find(FIND_SOURCES);

    // pulls old job, new job can be passed to contrucor
    this.set('job', memory.job ? memory.job : job);
    this.set('homeRoom', memory.homeRoom ? memory.homeRoom : this.creep.findClosestByRange(FIND_MY_SPAWNS));
  }

  load(target = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);
    const creepCapacity = this.creep.store.getCapacity();
    const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

    if (target) {
      const status = this.withdraw(target);
      if (status == ERR_INVALID_TARGET) this.set('target', null);
      return status;
    }

    if (droppedResources) {
      const piledResources = this.creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource) => resource.amount >= creepCapacity,
      });

      if (piledResources.length) {
        return this.pickup(piledResources[0]);
      } else {
        return this.pickup();
      }
    }

    if (!target) {
      // finds the Storage with enough energy
      target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] >= creepCapacity
      });
    }

    if (!target) {
      // finds the closest spawn
      target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => (structure.structureType == STRUCTURE_SPAWN) && structure.store[RESOURCE_ENERGY] >= 50,
      });
    }

    if (target) {
      return this.withdraw(target);
    }
  }

  unload(target = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      const targets = this.findEmptyStorages();
      if (targets && targets[0]) target = targets[0];
    }

    if (!target) {
      // the drone may have strayed out of the room
      if (this.creep.room !== this.get('homeRoom')) {
        this.moveToRoom(this.get('homeRoom'));
      } else {
        // moves to spawn for passive recharge and locality
        this.moveTo(this.creep.room.spawn);
      }
    }

    const result = this.transfer(target);
    if (result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_FULL || result === ERR_INVALID_TARGET) {
      this.enterStandby();
    }

    return result;
  }

  siege() {
    const hostileCreep = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    const warTargets = this.creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
      filter: (struct) => {
        console.log(struct);
        return true;
      }
    });

    let target = hostileCreep ? hostileCreep : warTargets;
    const status = this.attack(target);
    console.log('siege:status', status);
    return status;
  }

  toString() {
    return `{ name: ${this.name}, job: ${this.get('job')}, task: ${this.get('task')}}`;
  }

  processJob() {
    this.job = this.get('job');
    const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    const LOG = true;

    // all drones will prioritize recharging if they have been tasked with doing so.
    if (this.hasTask('recharge')) {
      this.transfer(spawn, RESOURCE_ENERGY);
      return;
    } else {
      // allows for a creep to finish deliving resources
      if (this.creep.ticksToLive < 350) {
        this.setTask('recharge', '❤️‍🩹');
      } else {
        if (this.creep.ticksToLive <= 500 && this.creep.pos.getRangeTo(spawn) <= 5) {
          this.setTask('recharge', '❤️‍🩹');
        }
      }
    }

    // console.log(this.creep.name, this.get('task'));
    switch(this.get('job')) {
      case 'mechanic':
      case 'drone':
        if (this.isStandby()) {
          if (this.isEnergyEmpty()) {
            const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

            if (droppedResources) {
              this.setTask('pickup');
            } else {
              this.setTask('harvest', '🔄 harvest');
            }
          } else {
            const towers = this.creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
            const repairTargets = this.creep.room.find(FIND_MY_STRUCTURES, {
              filter: object => (object.hits / object.hitsMax) <= 0.25 && object.hits <= 25000,
            });
            const buildTargets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
            const upgrader = this.creep.room.find(FIND_MY_CREEPS, { filter: (creep) => creep.memory.job !== 'upgrader' });
            console.log('drone');
            if (buildTargets && buildTargets.length) {
              if (LOG) console.log('build', buildTargets[0]);
              this.setTask('build', '🚧 build');
            }
            else if (!towers && repairTargets && repairTargets.length) {
              if (LOG) console.log('repair', repairTargets[0]);
              this.setTask('repair', '⚡ repair');
            }
            else if (towers.length && towers[0].store.getFreeCapacity(RESOURCE_ENERGY) > 50) {
              if (LOG) console.log('unload');
              this.set('target', towers[0].id);
              this.setTask('unload');
            }
            else if (this.creep.room.controller.level <= 3) {
              if (LOG) console.log('upgrade');
              this.setTask('upgrade');
            }
            else if (spawn && spawn.store.getUsedCapacity(RESOURCE_ENERGY) < 300) {
              if (LOG) console.log('unload2');
              this.setTask('unload');
            }

            // else if (!this.get(flag)) {
            //   this.moveToRoom(this.get('homeRoom'));
            // }
          }
        } else {
          if (this.hasTask('load') && this.isEnergyFull()) {
            this.setTask('standby');
          }
          else if ((this.hasTask('repair') || this.hasTask('build') || this.hasTask('unload')) && this.isEnergyEmpty()) {
            this.setTask('standby');
          }
        }
        break;

      case 'upgrader':
        if (this.isStandby()) {
          if (!this.isEnergyFull()) {
            const nearestContainer = this.creep.room.controller.pos.findClosestByPath(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } });
            if (nearestContainer) {
              this.set('target', nearestContainer.id);
            }
            this.setTask('load', '🚚');
          } else if (this.isEnergyFull()) {
            this.setTask('upgrade', '⚡ upgrade');
          }
        }
        break;

      case 'miner':
        if (this.isStandby()) {
          if (this.isEnergyEmpty()) {
            this.setTask('harvest', '🔄 harvest');
          } else {
            this.setTask('unload');
          }
        }
        break;

      case 'hauler':
        if (this.isStandby() && !this.isEnergyFull()) {
          const source = Game.getObjectById(this.get('source'));
          if (source) {
            const droppedResources = source.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            if (droppedResources) this.set('target', droppedResources);
          }
          this.setTask('pickup');
        } else if (!this.hasTask('unload') && this.isEnergyFull()) {
          this.setTask('unload');
        }
        break;

      default:
        break;
    }
  }

  /**
   * All tasks should run until they shift the bot into standby
   */
  run() {
    try {
      this.processJob();
      let target = this.get('target');
      const flag = this.getFlag();

      switch (this.task) {
        case 'pickup':
          const targetedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: { id: target }});
          const source = Game.getObjectById(this.get('source'));
          const energyNearSource = source && source.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

          if (targetedResources) {
            this.pickup(targetedResources);
          } else if (energyNearSource && energyNearSource.pos.isNearTo(source)) {
            this.pickup(energyNearSource);
          } else {
            this.pickup();
          }
          
          break;

        case 'load':
          this.load(target);
          break;

        case 'unload':
          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => (structure.structureType == STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 50)
                || (structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            });
          }

          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => structure.structureType == STRUCTURE_TOWER && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 500
            });
          }

          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => structure.structureType == STRUCTURE_CONTAINER && structure.store.getUsedCapacity(RESOURCE_ENERGY) <= 800
            });
          }

          if (!target) {
            // delivers resources to a worker in need
            target = this.creep.pos.findClosestByPath(FIND_MY_CREEPS, {
              filter: (creep) => {
                const loadingWorker = creep.memory.job !== 'hauler' && (creep.memory.task === 'load' || creep.memory.task === 'pickup' || creep.memory.task === 'harvest');
                const assistingUpgrader = creep.memory.job === 'drone' && creep.memory.task === 'upgrade';
                return loadingWorker || assistingUpgrader;
              },
            });
          }

          if (!target) {
            target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
              filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
          }

          this.unload(target);
          break;
        case 'drop': 
          this.dropAll();
          break;

        case 'harvest':
          if (this.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            this.setTask('standby');
            break;
          }

          if (this)
          // attempts to target the assigned Source
          this.harvest(this.get('source'));
          break;

        case 'build':
          this.build();
          break;

        case 'upgrade':
          this.upgrade();
          break;

        case 'repair':
          this.repair();
          break;

        case 'recharge':
          this.recharge();
          break;

          /**
           * What would a travel function look like?
           * - The ability to set a destination
           * - switches to an action other than standby
           */
          this.get('travelPlan');
          const travelPlan = {
            desitation: '',
            task: '',
          }
          this.travel()
          break;

        case 'attack':
          this.siege();
          break;

        case 'claim':
          this.claim();
          break;

        case 'flag':
          if (flag) {
            const status = this.moveTo(flag);
            const distanceToFlag = this.creep.pos.getRangeTo(flag);
            if (distanceToFlag <= 3) {
              if (flag.memory.task) this.setTask(flag.memory.task);
              if (flag.memory.source) this.set('source', flag.memory.source);
            }
          } else {
            this.set('flag', null);
            this.setTask('standby');
          }
          break;

        case 'standby':
        default:
          // do nothing
          break;
      }
    } catch (e) {
      console.log(this.creep.name,':', e);
    }
  }
}

module.exports = Drone;
