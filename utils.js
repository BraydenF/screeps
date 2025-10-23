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
        // pad to 6 hex digits to ensure valid color codes like '00a3f4'
        return Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    },
    randomSay: function randomSay() {
        // idea: group emojies by group / emotion
        return typeof emojis !== 'undefined' && emojis.length ? emojis[Math.floor(Math.random()*emojis.length)] : undefined;
    },
    toString: function (obj) {
        const keys = Object.keys(obj);
        console.log('***********************');
        keys.forEach(key => {
            console.log(key, obj[key]);
        });
    },
    Queue,
};

// ------------------------------
// Array convenience helpers
// ------------------------------
// NOTE: Kept the convenience Array.prototype helpers used elsewhere in the codebase,
// but made first() return undefined when empty and added an Array type check.
Array.prototype.rand = function() {
    if (!Array.isArray(this) || this.length === 0) return undefined;
    const index = Math.floor(Math.random()*this.length);
    return this[index];
};

Array.prototype.first = function() {
  return (Array.isArray(this) && this.length) ? this[0] : undefined;
}

// performs the provided function on the first element of the array if it exists
Array.prototype.onFirst = function(func) {
  const first = (Array.isArray(this) && this.length) ? this[0] : undefined;
  if (func && first) return func(first);
}

Array.prototype.onEmpty = function(func) {
    if (this.length == 0 && func) {
        return func();
    }
}

module.exports = utils;