const emojis = [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
    '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
    '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
    '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥',
    '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮',
    '🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓',
    '🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦',
    '😧','😨','😰','😥','😢','😭','😱','😖','😣','😞',
    '😓','😩','😫','🥱','😤','😡','😠', '🤬','😈','👿',
    '💀','💩','🤡','👹','👺','👻','👽','👾','🤖','🙈',
    '🙉','🙊','💋','💌','💘','💯','💢','💥','💫','💦',
    '💨','💣','💬','💭','💤','👋','🤚','✋','🖖',
];

global.w5 = [WORK, WORK, WORK, WORK, WORK];
global.w10 = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];

global.m5 = [MOVE, MOVE, MOVE, MOVE, MOVE];
global.m10 = [...m5, ...m5]; // 500

global.c5 = [CARRY, CARRY, CARRY, CARRY, CARRY]; // 250
global.c10 = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];

global.a5 = [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK]; // 400
global.ra5 = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK]; // 400

global.a10 = [...a5, ...a5]; // 800
global.ra10 = [...ra5, ...ra5];

global.h5 = [HEAL, HEAL, HEAL, HEAL, HEAL]; // 1250
global.h10 = [...h5, ...h5]; // 2500

global.m10c10 = [...c5, ...m5, ...c5, ...m5]; // 500 capacity
global.w10m5 = [...w5, ...w5, ...m5]; // cost 1250
global.w10m10 = [...w5, ...w5, ...m5, ...m5]; // cost 1500
global.w15m15 = [...w5, ...w5, ...w5, ...m5, ...m5, ...m5]; // cost 1800
global.m2c2 = [MOVE, MOVE, CARRY, CARRY];
global.m5c5 = [...m5, ...c5]; // 250 capacity
global.m10c10 = [...c5, ...m5, ...c5, ...m5]; // 500 capacity

// intershard memory stuff?

function roll() {
    return Math.floor(Math.random() * 100);
}

global.roll = roll;

const utils = {
  randomColor: function randomColor() {
    return Math.floor(Math.random()*16777215).toString(16);
  },
  randomSay: function randomSay() {
    // idea: grood emojies by group / emotion
    return emojis[Math.floor(Math.random()*emojis.length)];
  },
};

/** prototypes */
Array.prototype.rand = function() {
  const index = Math.floor(Math.random()*this.length);
  // console.log(`rand ${index} / this.length`);
  return this[index];
};

Array.prototype.first = function() {
  return this.length ? this[0] : undefined;
}

// performs the provided function on the first element of the array if it exists
Array.prototype.onFirst = function(func) {
  const first = this.length && this[0];
  if (func && first) return func(first);
}

Array.prototype.onEmpty = function(func) {
  if (this.length == 0 && func) {
    return func();
  }
}

Room.prototype.getHive = function() {
  return global.hives[this.name];
}

Room.prototype.getFactory = function() {
  let roomGlobal = global.rooms[this.name];
  return roomGlobal && roomGlobal.factory;
}

Room.prototype.spawnController = function() {
  const roomGlobal = global.rooms[this.name];
  return roomGlobal && roomGlobal.spawnController;
}

Room.prototype.labController = function() {
  const roomGlobal = global.rooms[this.name];
  return roomGlobal && roomGlobal.labController;
}

Room.prototype.factoryController = function() {
  const roomGlobal = global.rooms[this.name];
  return roomGlobal && roomGlobal.factoryController;
}

Room.prototype.taskController = function() {
  const roomGlobal = global.rooms[this.name];
  return roomGlobal && roomGlobal.taskController;
}

Room.prototype.resourceAmount = function(resource = 'energy') {
  let total = 0;
  if (this.storage) {
    total = total + this.storage.store[resource];  
  }

  if (this.terminal) {
    total = total + this.terminal.store[resource];  
  }
  return total;
}

global.hasKeys = function(obj) {
  for (const key in obj) {
    return true; // Returns true immediately upon finding the first key
  }
  return false;
}

global.tools = {
  viewCpu(func, label = 'cpu') {
    let cpu = Game.cpu.getUsed();
    const res = func && func()
    cpu = Game.cpu.getUsed() - cpu;
    console.log(label, cpu.toFixed(4));
    return res;
  },
  createDrone(job, body, memory) {
    const hive = GameMap.findNearestHive(room);
    return hive.spawnController.createDrone(job, body, memory);
  },
  createTargetMiner(room, source) {
    const hive = GameMap.findNearestHive(room);
    const body = [...m10, ...m10, ...w10, ...w10, CARRY, MOVE, MOVE, MOVE, MOVE];
    return hive.spawnController.createDrone('hauler', body, { targetRoom: room, source });
  },
  createTargetHauler(room, source) {
    const hive = GameMap.findNearestHive(room);
    const body = [...m10c10, ...m5c5, ...m10c10];
    return hive.spawnController.createDrone('hauler', body, { targetRoom: room, source });
  },
  createBankTank(room, powerBank) {
    const hive = GameMap.findNearestHive(room);
    const body = [...m10, ...m10, ...m5, ...ra10, ...ra5, ...h10];
    return hive.spawnController.createDrone('bankTank', body, { targetRoom: room, powerBank });
  },
  createPowerHauler(room, powerBank) {
    const hive = GameMap.findNearestHive(room);
    const body = [...m10c10, ...m5c5, ...m10c10];
    return hive.spawnController.createDrone('power-hauler', body, { targetRoom: room, powerBank });
  },
  inventory: function() {
    const inventory = {};

    for (const roomName in global.hives) {
      const hive = global.hives[roomName];

      if (hive) {
        const storage = hive.storage;
        const terminal = hive.terminal;
        for (const resource of RESOURCES_ALL) {
          let count = inventory[resource] || 0;

          if (storage) {
            count = count + storage.store.getUsedCapacity(resource); 
          }
          if (terminal) {
            count = count + terminal.store.getUsedCapacity(resource); 
          }
          if (count > 0) {
            inventory[resource] = count;
          }
        }
      }
    }

    Memory.inventory = inventory;
  },
}

module.exports = utils;
