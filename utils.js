
const utils = {
    roll: function() {
        return Math.floor(Math.random() * 100);
    },
    getRandomSource: function (sources) {
        const target = [utils.roll() < 50 ? 1 : 0];
        return target.id;
    },
    findResourceTargets(creep, resourceAmount = 0) {
        return creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN) &&
                    structure.store[RESOURCE_ENERGY] >= resourceAmount
            }
        });
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
    }
};

class Queue {
    constructor() {
        this.elements = {};
        this.head = 0;
        this.tail = 0;
    }
    enqueue(element) {
        this.elements[this.tail] = element;
        this.tail++;
    }
    dequeue() {
        const item = this.elements[this.head];
        delete this.elements[this.head];
        this.head++;
        return item;
    }
    peek() {
        return this.elements[this.head];
    }
    get length() {
        return this.tail - this.head;
    }
    get isEmpty() {
        return this.length === 0;
    }
}

module.exports = Queue;
module.exports = utils;
