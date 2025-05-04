const BaseCreep = require('Creep.class');
const config = require('config');

const { INITIAL_SPAWN, JOBS, DRONE_LIMIT, MODES } = config;

/**
 * Performs `tasks` based on the Drones assigned `job`
 */
class Drone extends BaseCreep {
    constructor(creep, job) {
      if (!creep) {
          throw new Error('Must supply a creep');
      }

    	super(creep);
      const memory = creep.memory || {};
      const sources = creep.room.find(FIND_SOURCES);

      // pulls old job, new job can be passed to contrucor
      this.set('job', job ? job : memory.job);
      this.set('mode', memory.mode ? memory.mode : 'standby');
      this.set('task', memory.task ? memory.task : 'standby');
      this.set('targetSource', memory.targetSource);
    }

    findResourceTargets(resourceAmount = 0) {
      return this.creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.structureType == STRUCTURE_EXTENSION ||
            structure.structureType == STRUCTURE_SPAWN ||
            structure.structureType == STRUCTURE_STORAGE
          ) && structure.store[RESOURCE_ENERGY] >= resourceAmount
        }
      });
    }

    findEmptyStorages() {
      return this.creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.structureType == STRUCTURE_SPAWN ||
            structure.structureType == STRUCTURE_EXTENSION ||
            structure.structureType == STRUCTURE_TOWER ||
            structure.structureType == STRUCTURE_CONTAINER
            ) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
    }

    dropAll() {
        // drop all resources
        for(const resourceType in this.creep.carry) {
            this.creep.drop(resourceType);
        }
    }

    pickup(target = null) {
      if (!target) {
        target = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
      }

      if (target) {
          if(this.creep.pickup(target) == ERR_NOT_IN_RANGE) {
              this.creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
          }
      } else {
        this.creep.note = 'No resources to pickup.';
      }
    }

    withdrawl(target) {
    	if(this.creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
		    this.creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
		  }
    }

    load(target = null) {
      const creepCapacity = this.creep.store.getCapacity();
      const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

      if (target) {
        return this.withdrawl(target);
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
        // finds the closest container with enough energy
        target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] >= creepCapacity
        });
      }

      if (!target) {
        // finds the closest spawn or extension
        target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => (structure.structureType == STRUCTURE_SPAWN || structure.structureType ==  STRUCTURE_EXTENSION) && structure.store[RESOURCE_ENERGY] >= 50,
        });
      }

      if (target) {
        return this.withdrawl(target);
      }
    }

    unload(target = null) {
      if (!target) {
        target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => (structure.structureType == STRUCTURE_SPAWN || structure.structureType ==  STRUCTURE_EXTENSION)
            && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }

      if (!target) {
        target = this.creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
      }

      if (!target) {
        const targets = this.findEmptyStorages();
        if (targets && targets[0]) target = targets[0];
      }

      if (!target) {
        throw ('No empty storage in room' + this.creep.room);
      }

      return this.transfer(target);
    }

    repair() {
        const targets = this.creep.room.find(FIND_STRUCTURES, {
            filter: object => object.hits < object.hitsMax
        });
        targets.sort((a,b) => a.hits - b.hits);
        if (targets.length > 0) {
            if (this.creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
                this.creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }

    build() {
        const targets = this.creep.room.find(FIND_CONSTRUCTION_SITES);

    	// todo: how can we better handle the build order? Do we need a build queue?

        if (targets.length) {
            if (this.creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                this.creep.moveTo(targets[0], { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }

    upgrade() {
    	const controller = this.creep.room.controller;
    	if (this.creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
        this.creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
      }
    }

    recharge() {
      // todo: get recharged by the spawn
      // find nearest spawn  
      // move to the spawn
      const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);

      const rechargeAttempt = spawn.renewCreep(this.creep);
      console.log('renewCreep', rechargeAttempt);
      if (rechargeAttempt === ERR_NOT_IN_RANGE) {
        this.creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffffff' } });
      } else if (rechargeAttempt === ERR_FULL) {
        this.setTask('standby');
      }
    }

    toString() {
        return `{ name: ${this.name}, job: ${this.get('job')}, task: ${this.get('task')}}`;
    }

    processJob() {
      this.job = this.get('job');

      function withdrawlOrHarvest(obj) {
          if (obj) {
              const targets = obj.findResourceTargets(1);
              if (targets[0].room.energyAvailable > 350) {
                  return { mode: MODES.WITHDRAWL, message: '🔄 filling up!' };
              }

              return { mode: MODES.HARVEST, message: '🔄 harvest' };
          }
      }

      // all drones will prioritize recharging if they have been tasked with doing so.
      if (this.hasTask('recharge')) {
        // task will remain unmodified.
        return;
      }

      if (this.job === 'scout') {
          this.set('targetSource', '5bbcadf79099fc012e638375');
          const targetSource = this.get('targetSource');

          // console.log(targetSource, Game.getObjectById(outerResource));
          console.log(this.creep.name, '|', this.creep.harvest(targetSource), ERR_NOT_IN_RANGE);
          // console.log(this.creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ffaa00' } }));

          // if (this.creep.harvest(targetSource) == ERR_NOT_IN_RANGE) {
          //     this.creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ffaa00' } });
          // }

          // console.log('here?', this.creep.room.name);

          // const room = Game.spawns['spawn'].room;
          const roomName = this.creep.room.name;
          const exits = Game.map.describeExits(roomName);

          // console.log(exits[TOP]);
          // console.log(exits[RIGHT]);
          // console.log(exits[BOTTOM]);
          const leftRoomName = exits[LEFT];
          // this.harvest();

          /** todo
           * think of this like a harvest/movement subsystem.
           * If we can not target something we have the ID of, it is
           * in a different room. Then I just need to dermine
           * which direction the element is
           * (if possible)
           */
          // note: loops to left room infinitely
          const route = Game.map.findRoute(this.creep.room, leftRoomName);
          if(route.length > 0) {
              console.log('Now heading to room ' + route[0].room);
              const exit = this.creep.pos.findClosestByRange(route[0].exit);
              this.creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
          }
      }

      else if (this.job === 'upgrader') {
          if (this.isStandby()) {
              this.setTask('upgrade');
          }

          if (this.hasTask('upgrade') && this.isEnergyEmpty()) {
              // const { mode, message } = (this);
              this.setTask('load');
          } else if (!this.hasTask('upgrade') && this.isEnergyFull()) {
              this.setTask('upgrade', '⚡ upgrade');
          }
      }
      else if (this.job === 'builder') {
          // job change condition: nothing to build
          const targets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
          if (!targets.length) {
            this.set('job', JOBS.UPGRADER);
          }

          if (this.isStandby()) {
            this.setTask('build');
          }
  
          if (this.hasTask('build') && this.isEnergyEmpty()) {
            const containers = this.creep.room.find(FIND_STRUCTURES, { filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] >= 1 });
            if (containers) {
              this.setTask('load');
            } else {
              const { mode, message } = withdrawlOrHarvest(this);
              this.setTask(mode, message);
            }
          } else if (!this.hasTask('build') && this.isEnergyFull()) {
              this.setTask('build', '🚧 build');
          }
  	  }
      else if (this.job === JOBS.MECHANIC) {
          // job change condition: nothing to repair
          const targets = this.creep.room.find(FIND_STRUCTURES, {
            filter: object => object.hits < object.hitsMax
          });
          if (!targets.length) {
            this.set('job', JOBS.HARVESTER);
          }

          if (this.isStandby()) {
            this.setTask('repair', '⚡ repair');
          }
          if (!this.hasTask('repair') && this.isEnergyEmpty()) {
            // const { mode, message } = withdrawlOrHarvest(this);
            this.setTask('harvest', '🔄 harvest');
          }
          if (!this.hasTask('repair') && this.isEnergyFull()) {
            this.setTask('repair', '⚡ repair');
          }
      }

      else if (this.job === 'harvester') {
        if (this.isStandby()) {
          this.setTask('harvest');
        }
        else if (!this.hasTask('harvest') && this.isEnergyEmpty()) {
          this.setTask('harvest', '🔄 harvest');
        }
        else if (!this.hasTask('transfer') && this.isEnergyFull()) {
          this.setTask('unload');
        }
      }

      else if (this.job === 'miner') {
        if (this.isStandby()) {
          this.setTask('harvest');
        }
        if (!this.hasTask('harvest') && this.isEnergyEmpty()) {
          this.setTask('harvest', '🔄 harvest');
        }
        else if (!this.hasTask('transfer') && this.isEnergyFull()) {
          this.setTask('unload');
        }
      }

      else if (this.job === 'hauler') {
          if (this.isStandby() || this.hasTask('unload') && this.isEnergyEmpty()) {
            const droppedResources = this.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            if (droppedResources) {
              this.setTask('load');
            } else {
              this.setTask('standby');
            }
          }
          else if (!this.hasTask('transfer') && this.isEnergyFull()) {
              this.setTask('unload');
          }
      }
    }

    run () {
      this.processJob();

      switch (this.task) {
        case 'load':
          let target = this.get('target');
          if (target) {
            const targets = this.creep.room.find(FIND_STRUCTURES, {
              filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER && structure.id === target;
              }
            });
            if (targets && targets[0]) target = targets[0];
          }

          this.load(target);
          break;

        case 'unload':
          this.unload();
          break;

        case 'harvest':
          this.harvest();
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

        case 'standby':
        default:
          // do nothing
          break;
      }
    }
}

module.exports = Drone;
