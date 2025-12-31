const Queue = global.Queue;
const GameMap = require('GameMap');
const productionNotifier = require('productionNotifier');

/**
 * 
 * Game.powerCreeps['Zyphir'].
 * Game.powerCreeps['Zyphir'].spawn(Game.getObjectById('68d5190bc65c030376c56e38'));
 * Game.powerCreeps['Zyphir'].enableRoom(Game.getObjectById('5bbcacbf9099fc012e636211'));
 * Game.powerCreeps['Zyphir'].usePower(PWR_GENERATE_OPS);
 * Game.powerCreeps['Zyphir'].usePower(PWR_OPERATE_FACTORY, Game.getObjectById('6875fa67dcc52ed662e430f0'));
 * 
 */

class PowerCreep {
	static run () {
		// console.log(Game.powerCreeps);
    for (const name in Game.powerCreeps) {
   	  const pc = new PowerCreep(Game.powerCreeps[name]);
   	  if (pc.pc.ticksToLive) {
   	  	pc.run();
   	  } else if (!pc.pc.spawnCooldownTime) {
   	  	// const controller = Game.getObjectById('68d5190bc65c030376c56e38');
   	  	// pc.spawn(controller);
   	  }
    }
	}

	constructor(powerCreep) {
    const memory = powerCreep.memory || {};
    this.name = powerCreep.name;
		this.pc = powerCreep;
    this.task = memory.task ? memory.task : 'standby';
    this.taskQueue = new Queue(memory.taskQueue);
  }

  get(key) {
    return this.pc.memory[key];
  }

  set(key, value) {
    this.pc.memory[key] = value;
  }

  getTarget() {
    return Game.getObjectById(this.get('target'));
  }

  setTarget(target) {
    if (typeof target === 'object' && target.id) target = target.id;
    if (typeof target === 'string') {
      this.set('target', target);
    } else if (!target) {
      this.set('target', null)
    }
  }

  hasTask(task) {
    return this.task === task;
  }

  setTask(task, target = null, message = null) {
    this.set('task', task);
    if (target) this.setTarget(target);
    if (message) this.pc.say(message);
  }

  getTaskQueue() {
    return this.taskQueue;
  }

  setTaskQueue(tasks, message) {
    this.taskQueue = new Queue(tasks);
    this.set('taskQueue', tasks);
    if (message) this.pc.say(message);
  }

  pushTask(task) {
    this.taskQueue.enqueue(task);
  }

  hasTaskQueued() {
    return !this.taskQueue.isEmpty;
  }

  isStandby() {
    return !this.task || this.hasTask('standby');
  }

  enterStandby(message) {
    if (message) this.pc.say(message);
    this.setTask('standby');
    this.set('target', null);
    this.set('resource', undefined);
    this.set('amount', undefined);
    this.set('_move', undefined);
  }

  moveTo(target) {
    if (typeof target === 'string') target = Game.getObjectById(target);
    if (typeof target === 'number') {
      const exit = this.pc.pos.findClosestByRange(target);
      return this.pc.moveTo(exit, { reusePath: 5, visualizePathStyle: { stroke: '#ffffff' } });
    }

    if (target.pos && this.pc.room.name === target.pos.roomName) {
      if (this.pc.fatigue === OK) {
        return this.pc.moveTo(target, { reusePath: 3, visualizePathStyle: { stroke: '#ffffff' } });
      } else {
        Game.map.visual.line(this.pc.pos, target.pos, { width: 0.3 });
        return ERR_TIRED;
      }
    } else {
      const route = GameMap.findRoute(this.pc.room.name, target && (target.roomName || target.pos.roomName));

      if (route.length > 0) {
        const exit = this.pc.pos.findClosestByPath(route[0].exit);
        if (target.pos.roomName === 'E6N56') console.log('route.length', route.length);
        if (route.length >= 2) {
          return this.pc.moveTo(exit, { reusePath: 15, visualizePathStyle: { stroke: '#ffffff' } });
        } else {
          const ret = PathFinder.search(this.pc.pos, exit, { maxRooms: 2 });
          return this.pc.move(this.pc.pos.getDirectionTo(ret.path[0]));
        }
      }
    }
  }

  withdraw(target, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target && !this.pc.pos.isNearTo(target)) {
      this.pc.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const withdrawAttempt = this.pc.withdraw(target, resource, amount);
    if (withdrawAttempt == ERR_NOT_IN_RANGE) {
      this.pc.moveTo(target);
    } else if (withdrawAttempt === ERR_FULL || withdrawAttempt === ERR_NOT_ENOUGH_RESOURCES || withdrawAttempt === ERR_INVALID_TARGET) {
      this.enterStandby();
    }
    return withdrawAttempt;
  }

  transfer(target, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target && !this.pc.pos.isNearTo(target)) {
      this.pc.moveTo(target);
      return ERR_NOT_IN_RANGE;
    }

    const status = this.pc.transfer(target, resource, amount);
    if (status == ERR_NOT_IN_RANGE) {
      this.pc.moveTo(target);
    }
    return status;
  }

  load(target = null, resource = RESOURCE_ENERGY, amount = null) {
    // console.log('loading', target, resource, amount)
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target) {
      const status = this.withdraw(target, resource, amount);
      if (status == ERR_INVALID_TARGET) this.set('target', undefined);
      return status;
    }
  }

  unload(target = null, resource = RESOURCE_ENERGY, amount = null) {
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (!target) {
      // the drone may have strayed out of the room
      if (this.pc.room !== this.get('targetRoom')) {
        this.moveToRoom(this.get('targetRoom'));
      }
    }

    if (!target) {
      const targets = this.findEmptyStorages();
      if (targets && targets[0]) target = targets[0];
    }

    const status = this.transfer(target, resource, amount);
    // console.log('unload', target, resource, status)
    if (status === ERR_NOT_ENOUGH_RESOURCES || status === ERR_FULL || status === ERR_INVALID_TARGET) {
      this.enterStandby();
    }

    return status;
  }

  operateFactory(factory) {
  	if (this.pc.pos.isNearTo(factory)) {
  		this.pc.usePower(PWR_OPERATE_FACTORY, factory);
  	} else {
  		this.pc.moveTo(factory);
  	}
  }

  run () {
  	try {
      let target = this.get('target');
      let resource = this.get('resource');
      let amount = this.get('amount');
      const room = this.pc.room;

      switch (this.get('task')) {
        case 'moveTo':
          this.moveTo(target);
          if (this.pc.pos.getRangeTo(target) === 0) this.enterStandby();
          break;

        case 'load':
          if (this.load(target, resource, amount) === OK) {
            this.enterStandby();
          };
          break;

        case 'unload':
          // non energy resources default to storage.
          if (!target && this.pc.room.storage) {
            target = this.pc.room.storage;
          }

          // nothing to unload or target the is full
          if (Object.keys(this.pc.store).length === 0) this.enterStandby();
          else if (target && target.store && target.store.getFreeCapacity() === 0) this.enterStandby();

          if (target && !this.getTarget()) this.setTarget(target);
          if (this.unload(target, resource, amount) === OK) {
            this.enterStandby();
          }
          break;

        case 'enablePower':
          // enable power
          if (this.pc.pos.isNearTo(controller)) {
            const status = this.pc.enableRoom(controller);
            if (status === OK) this.enterStandby();
          } else {
            this.pc.moveTo(controller);
          }
          break;

        default:
        	// target room behavior is ran by default.
		      if (this.pc.memory.targetRoom === room.name) {
		      	const controller = room.controller;
            if (!controller.isPowerEnabled) {
              this.setTask('enablePower');
              break;
            }

            const hasFactoryBoost = this.pc.powers[PWR_OPERATE_FACTORY].cooldown === OK;
            if (hasFactoryBoost) {
              if (this.pc.store.getUsedCapacity('ops') < 100 && room.terminal && room.terminal.store.getUsedCapacity('ops') > 0) {
                this.setTask('load', room.terminal.id);
                this.set('resource', 'ops');
                this.set('amount', 100 - this.pc.store.getUsedCapacity('ops'));
                break;
              }

              const factory = this.pc.powers[PWR_OPERATE_FACTORY] ? (() => {
                const factoryMem = room.memory.factory;
                const hasPowerJob = factoryMem.id && factoryMem.job && factoryMem.job.ready;

                if (hasPowerJob && factoryMem.job.level === this.pc.powers[PWR_OPERATE_FACTORY].level) {
                  return Game.getObjectById(room.memory.factory.id);
                }
              })() : null;

              const factoryNeedsBoost = factory && factory.effects.length === OK;
              if (factoryNeedsBoost && this.pc.powers[PWR_OPERATE_FACTORY].cooldown === OK) {
                if (this.pc.store.getUsedCapacity('ops') >= 100) {
                  this.operateFactory(factory);
                  break;
                }
              }
            }

            if (this.pc.store.getUsedCapacity('ops') > 200) {
              this.setTask('unload', room.terminal.id);
              this.set('resource', 'ops');
              break;
            }

            if (this.pc.powers[PWR_GENERATE_OPS] && this.pc.powers[PWR_GENERATE_OPS].cooldown === OK && this.pc.store.getFreeCapacity('ops') > 0) {
	      			const status = this.pc.usePower(PWR_GENERATE_OPS);
              if (status === OK) {
                const opsGenerated = Math.floor(this.pc.powers[PWR_GENERATE_OPS].level / 2) + 1;
                productionNotifier.incrementCounter('ops', opsGenerated);
              }
	      		} else if (room.memory.powerSpawn && this.pc.ticksToLive < 4000) {
	      			const ps = Game.getObjectById(room.memory.powerSpawn.id);
	      			if (this.pc.pos.isNearTo(ps)) {
	      				this.pc.renew(ps);
	      			} else {
	      				this.pc.moveTo(ps);
	      			}
	      		} else {
              const ps = Game.getObjectById(room.memory.powerSpawn.id);
              if (!this.pc.pos.isNearTo(ps)) this.pc.moveTo(ps);
	      			// console.log('nothing')
	      		}
		      } else {
            console.log(Game.rooms[this.pc.memory.targetRoom]);
		      	this.moveTo(Game.rooms[this.pc.memory.targetRoom].controller);
		      }

        	break;
      }
    } catch (e) {
      console.log(this.pc.name,':', e);
      // throw e;
    }
  }
}

module.exports = PowerCreep;
