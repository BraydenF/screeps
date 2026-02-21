const config = require('config');
const GameMap = require('GameMap');
const productionNotifier = require('productionNotifier');

/**
 * 
 * Game.powerCreeps['Hephaestus'].spawn(Game.getObjectById('68cca88cf686844588848795'));
 * Game.powerCreeps['Hephaestus II'].spawn(Game.getObjectById('68d39ca14f118a576616e843'));
 * 
 * Game.powerCreeps['Hephaestus'].enableRoom(Game.getObjectById('5bbcacbf9099fc012e636211'));
 * Game.powerCreeps['Hephaestus II'].usePower(PWR_OPERATE_FACTORY, Game.getObjectById('6875fa67dcc52ed662e430f0'));
 * 
 */

const LOG_CPU = true;
const homePowerSpawn = {
  'Hephaestus': '68cca88cf686844588848795',
  'Hephaestus II': '68d39ca14f118a576616e843',
  'Hephaestus III': '68d5190bc65c030376c56e38',
};

class PowerCreep {
  get pc () {
    return Game.powerCreeps[this.name];
  }

  get task() {
    return memory.task ? memory.task : 'standby';
  }

  get room() {
    return this.pc.room;
  }

  get store() {
    return this.pc.store;
  }

	static run () {
    if (!global.powerCreeps) global.powerCreeps = {};
    // let powerCreepCpu = Game.cpu.getUsed();

    for (const name in Game.powerCreeps) {
      // if (LOG_CPU) powerCreepCpu = Game.cpu.getUsed();
      const pc = Game.powerCreeps[name];
      const powerCreep = global.powerCreeps[name];

      if (powerCreep && pc.ticksToLive) {
        powerCreep.run();
      } else if (pc) {
        if (pc.ticksToLive) {
          global.powerCreeps[name] = new PowerCreep(pc);
        } else if (!pc.spawnCooldownTime) {
          pc.spawn(Game.getObjectById(homePowerSpawn[name]));
        }
      }

      // if (LOG_CPU) console.log(name, (Game.cpu.getUsed() - powerCreepCpu).toFixed(4));
    }
	}

	constructor(powerCreep) {
    this.name = powerCreep.name;
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

  setTaskQueue(tasks, message) {
    this.set('taskQueue', tasks);
    if (message) this.pc.say(message);
  }

  isStandby() {
    return !this.task || this.hasTask('standby');
  }

  enterStandby() {
    this.pc.memory = {
      ...this.pc.memory,
      task: null,
      target: undefined,
      resource: undefined,
      amount: undefined,
      _move: undefined,
    };
  }

  processTaskQueue() {
    const taskQueue = this.get('taskQueue');
    if (!taskQueue.isEmpty) {
      const qtask = taskQueue.shift();
      this.setTaskQueue(taskQueue);

      if (typeof qtask === 'object') {
        if (qtask.name) {
          this.setTask(qtask.name);
          if (qtask.target) this.setTarget(qtask.target);
          if (qtask.resource) this.set('resource', qtask.resource);
        }
      } else {
        this.setTask(qtask);
      }
    }
  }

  moveTo(target) {
    if (this.pc.fatigue > 0) return ERR_TIRED;

    let targetPos;
    if (target instanceof RoomPosition) {
      targetPos = target;
    } else if (typeof target === 'string') {
      const obj = Game.getObjectById(target);
      targetPos = obj ? obj.pos : null;
    } else if (target && target.pos) {
      targetPos = target.pos;
    } else if (target && target.roomName && target.x && target.y) {
      targetPos = new RoomPosition(target.x, target.y, target.roomName);
    }

    if (!targetPos) {
      this.set('target', null);
      return ERR_INVALID_TARGET;
    }

    if (this.pc.room.name === targetPos.roomName) {
      return this.pc.moveTo(targetPos, config.moveToOpts);
    } else {
      const route = GameMap.findRoute(this.pc.room.name, targetPos.roomName);
      if (!route || route === ERR_NO_PATH || route.length === 0) {
        return ERR_NO_PATH;
      }

      const nextExitDir = route[0].exit;
      const exitPos = this.pc.pos.findClosestByRange(nextExitDir);
      if (!exitPos) return ERR_NO_PATH;

      return this.pc.moveTo(exitPos, {
        ...config.moveToOpts,
        maxRooms: route.length + 1,
        reusePath: 50,
      });
    }
    return ERR_NO_PATH;
  }

  moveToRoom(roomName) {
    if (this.pc.fatigue > 0) return ERR_TIRED;
    const route = GameMap.findRoute(this.pc.room.name, roomName);
    if (route.length > 0) {
      const exitPos = this.pc.pos.findClosestByRange(route[0].exit);
      if (exitPos) {
        return this.pc.moveTo(exitPos, { ...config.moveToOpts, reusePath: 50 });
      }
    }
    return ERR_NO_PATH;
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
    if (typeof target === 'string') target = Game.getObjectById(target);

    if (target) {
      const status = this.withdraw(target, resource, amount);
      // console.log('loading', target, resource, amount, status);
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

  operateExtension(target) {
    if (!target) target = this.room.storage;
    if (this.pc.pos.inRangeTo(target, 3)) {
      const status = this.pc.usePower(PWR_OPERATE_EXTENSION, target);
      if (status === OK || status === ERR_TIRED || status === ERR_NO_BODYPART) {
        this.enterStandby();
      }
    } else {
      this.pc.moveTo(target);
    }
  }

  operateLab(lab) {
    if (typeof lab === 'string') lab = Game.getObjectById(lab);

    if (this.pc.pos.inRangeTo(lab, 3)) {
      const status = this.pc.usePower(PWR_OPERATE_LAB, lab);
      if (status === OK || status === ERR_TIRED || status === ERR_NO_BODYPART) {
        this.set('targetLab', undefined);
        this.enterStandby();
      }
    } else {
      this.pc.moveTo(lab);
    }
  }

  operateFactory(factory) {
  	if (this.pc.pos.inRangeTo(factory, 3)) {
  		const status = this.pc.usePower(PWR_OPERATE_FACTORY, factory);
      if (status === OK || status === ERR_TIRED || status === ERR_NO_BODYPART) {
        this.enterStandby();
      }
  	} else {
  		this.pc.moveTo(factory);
  	}
  }

  getPower(pwr) {
    return this.pc.powers[pwr];
  }

  hasOps(number = 0) {
    return this.pc.store.getUsedCapacity('ops') >= number;
  }

  getEnergyTarget() {
    const room = this.room;
    const factory = room.getFactory();

    if (factory && factory.store['energy'] >= 11000) {
      return factory.id;
    } else if (room.terminal && room.terminal.store['energy'] >= 25000) {
      return room.terminal.id;
    } else if (room.storage && room.storage.store['energy'] > 15000) {
      return room.storage.id;
    }
  }

  run() {
  	try {
      let target = this.get('target');
      let resource = this.get('resource');
      let amount = this.get('amount');
      const room = this.pc.room;
      const freeCapacity = this.pc.store.getFreeCapacity('ops');
      const myOps = this.pc.store.getUsedCapacity('ops');

      switch (this.get('task')) {
        case 'moveTo':
          this.moveTo(target);
          if (this.pc.pos.getRangeTo(target) === 0) this.enterStandby();
          break;

        case 'load':
          const status = this.load(target, resource, amount);
          if (status === OK || status === ERR_FULL) {
            this.enterStandby();
          }
          break;

        case 'unload':
          // non energy resources default to storage.
          if (!target && this.pc.room.storage) {
            target = this.pc.room.storage;
          }

          // nothing to unload or target the is full
          if (!global.hasKeys(this.pc.store)) this.enterStandby();
          else if (target && target.store && target.store.getFreeCapacity() === 0) this.enterStandby();

          if (target && !this.getTarget()) this.setTarget(target);
          if (this.unload(target, resource, amount) === OK) {
            this.enterStandby();
          }
          break;

        case 'enablePower':
          const controller = this.pc.room.controller;
          if (this.pc.pos.isNearTo(controller)) {
            const status = this.pc.enableRoom(controller);
            if (status === OK) this.enterStandby();
          } else {
            this.pc.moveTo(controller);
          }
          break;

        case 'operateFactory':
          const factory = Game.getObjectById(room.memory.factory.id);
          if (factory) this.operateFactory(factory);
          break;

        case 'operateExtension':
          let targetStorage = room.storage;
          if (room.terminal && room.terminal.store['energy'] >= 35000) {
            targetStorage = room.terminal;
          }
          this.operateExtension(targetStorage);
          break;

        case 'operateLab':
          // let targetStorage = room.storage;
          // if (room.terminal && room.terminal.store['energy'] >= 35000) {
          //   targetStorage = room.terminal;
          // }
          this.operateLab(this.get('targetLab'));
          break;

        default:
          // add support for the task Queue
          // const tasks = this.get('taskQueue');
          // if (tasks && tasks.length > 0) return this.processTaskQueue();

		      if (this.pc.memory.targetRoom === room.name && Game.time % 2 === 0) {
            // I should let the room know I'm here?
		      	const controller = room.controller;
            if (!controller.isPowerEnabled) {
              this.setTask('enablePower');
              break;
            }

            const opOps = this.getPower(PWR_GENERATE_OPS);
            if (opOps && opOps.cooldown === OK && freeCapacity > 0) {
              const status = this.pc.usePower(PWR_GENERATE_OPS);
              if (status === OK) {
                const opsGenerated = Math.floor(this.pc.powers[PWR_GENERATE_OPS].level / 2) + 1;
                productionNotifier.incrementCounter('ops', opsGenerated);
              }
            }

            const opFactory = this.getPower(PWR_OPERATE_FACTORY);
            if (opFactory && opFactory.cooldown === OK) {
              const amountStored = room.terminal ? room.terminal.store.getUsedCapacity('ops') : 0;
              if (myOps <= 100 && amountStored > 0) {
                this.setTask('load', room.terminal.id);
                this.set('resource', 'ops');
                this.set('amount', 100);
                break;
              }

              const factory = opFactory ? (() => {
                const factoryMem = room.memory.factory;
                const hasPowerJob = factoryMem.id && factoryMem.job && factoryMem.job.ready;

                if (hasPowerJob && factoryMem.job.level === opFactory.level) {
                  return Game.getObjectById(room.memory.factory.id);
                }
              })() : null;

              const factoryNeedsBoost = factory && factory.effects.length === OK;
              if (factoryNeedsBoost && this.hasOps(100)) {
                this.setTask('operateFactory');
                break;
              }
            }

            const opExtension = this.getPower(PWR_OPERATE_EXTENSION);
            if (opExtension && opExtension.cooldown === OK && this.hasOps(2)) {
              if (room.energyAvailable / room.energyCapacityAvailable < 0.65) {
                this.setTask('operateExtension');
                break;
              }
            }

            const opLab = this.getPower(PWR_OPERATE_LAB);
            if (opLab && opLab.cooldown === OK && this.hasOps(10)) {
              const labController = this.room.labController();
              const lab = labController ? labController.getOperableLab() : null;
              if (lab) {
                this.set('targetLab', lab.id);
                this.setTask('operateLab');
                break;
              }
            }

            // const opSpawn = this.getPower(PWR_OPERATE_SPAWN);
            // if (opSpawn && opSpawn.cooldown == OK ) {
            //   if (room.memory.mode === 'power') {
            //     // this.operateSpawn();
            //   }
            // }

            if (myOps > 200) {
              this.setTask('unload', room.terminal.id);
              this.set('resource', 'ops');
              this.set('amount', 100);
              break;
            }

            if (room.memory.powerSpawn) {
	      			const ps = Game.getObjectById(room.memory.powerSpawn.id);
              const storedEnergy = this.room.storage.store['energy'];
              const energyStore = freeCapacity > 0 ? this.getEnergyTarget() : null;

              if (this.pc.store['energy'] > 0) {
                this.setTask('unload', ps.id);
                break;
              } else if (this.pc.store['power'] > 0) {
                this.setTask('unload', ps.id);
                this.set('resource', 'power');
                break;
              } else if (energyStore && freeCapacity > 0) {
                if (ps.store.getFreeCapacity('energy') >= freeCapacity) {
                  this.setTask('load', energyStore);
                  break; 
                } else if (ps.store.getFreeCapacity('power') >= 100 && this.room.storage.store['power'] >= 100) {
                  this.setTask('load', this.room.storage.id);
                  this.set('resource', 'power');
                  this.set('amount', 100);
                  break;
                }
              }

	      			if (!this.pc.pos.isNearTo(ps)) {
                this.pc.moveTo(ps);
	      			} else if (this.pc.ticksToLive < 4000) {
                this.pc.renew(ps);
	      			}
	      		}
		      } else {
            if (this.pc.memory.targetRoom) {
              this.moveToRoom(this.pc.memory.targetRoom);
            } else {
              this.set('targetRoom', this.pc.room.name);
            }
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
