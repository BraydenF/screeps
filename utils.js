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

Room.prototype.taskController = function() {
  return global.rooms[this.name] && global.rooms[this.name].taskController;
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

module.exports = utils;
