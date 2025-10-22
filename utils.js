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

class Queue {
    constructor(items = []) {
        this.items = items;
    }
    enqueue(element) {
        this.items.push(element); 
    }
    enQ(element) {
        return this.enqueue(element);
    }
    dequeue() {
        return this.isEmpty ? undefined : this.items.shift();
    }
    deQ() {
        return this.dequeue();
    }
    peek() {
        return this.isEmpty ? undefined : this.items[0];
    }
    get length() {
        return this.items.length;
    }
    get isEmpty() {
        return this.items.length === 0;
    }
}

global.Queue = Queue;

function roll() {
    return Math.floor(Math.random() * 100);
}

global.roll = roll;

const utils = {
    findResourceTargets(creep, resourceAmount = 0) {
        return creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN) &&
                    structure.store[RESOURCE_ENERGY] >= resourceAmount
            }
        });
    },
    getRandomSource: function(sources) {
        const target = sources[roll() < 50 ? 1 : 0];
        return target.id;
    },
    /**
     * https://stackoverflow.com/a/3983830
     * @params probas number[]
     * @params funcs function[]
     */
    randexec: function (probas, funcs) {
        var ar = [];
        var i,sum = 0;
        // that following initialization loop could be done only once above that
        // randexec() function, we let it here for clarity
        for (i=0 ; i<probas.length-1 ; i++) { // notice the '-1'
            sum += (probas[i] / 100.0);
            ar[i] = sum;
        }

        // Then we get a random number and finds where it sits inside the probabilities 
        // defined earlier
        var r = Math.random(); // returns [0,1]
        for (i=0 ; i<ar.length && r>=ar[i] ; i++) ;

        // Finally execute the function and return its result
        return (funcs[i])();
    },
    randomColor: function randomColor() {
        return Math.floor(Math.random()*16777215).toString(16);
    },
    randomSay: function randomSay() {
        // idea: grood emojies by group / emotion
        return emojis[Math.floor(Math.random()*emojis.length)];
    },
    roll,
    toString: function (obj) {
        const keys = Object.keys(obj);
        console.log('***********************');
        keys.forEach(key => {
            console.log(key, obj[key]);
        });
    },
    Queue,
};

Array.prototype.rand = function() {
    const index = Math.floor(Math.random()*this.length);
    // console.log(`rand ${index} / this.length`);
    return this[index];
};

Array.prototype.first = function() {
  return this.length && this[0];
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

/** Test code that has been deprecated, wanted to keep the structure and basic idea */
class MiningTeam {
  constructor(spawn, source) {
    this.key = `miningTeam-${source}`;
    if (!Memory[this.key]) {
      Memory[this.key] = { source: source, miner: null, haulers: [] }; 
    }

    this.spawn = spawn;
    this.source = source;
    this.memory = Memory.rooms[this.key];

    const miners = spawn.room.find(FIND_MY_CREEPS, {
      filter: (creep) => {
        return creep.memory.source === source && creep.memory.job === 'miner';
    }});

    if (miners && miners.length) {
      this.miner = miners[0];
    }

    const haulers = spawn.room.find(FIND_MY_CREEPS, {
      filter: { memory: { source: source, job: 'hauler' } },
    });

    if (haulers && haulers.length) {
      this.haulers = haulers;
    }
  }

  run() {
    if (Array.isArray(this.haulers)) {
      this.haulers.forEach((hauler) => {
        // find dropped Resources nearest the Source
        const source = Game.getObjectById(hauler.memory.source);

        if (hauler.memory.task === 'load' || hauler.memory.task === 'pickup') {
          const droppedResources = source.pos.findClosestByRange(FIND_DROPPED_RESOURCES);

          if (droppedResources) {
            // targets the dropped resources closest to the deposit
            hauler.memory.target = droppedResources.id;
          }
        } else if (hauler.memory.task === 'unload') {
          // add special target rules
        }
      });
    }
  }
}

module.exports = utils;
