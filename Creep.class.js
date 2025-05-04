/**
 * Base unit implementation
 */
class BaseCreep {
	constructor(creep) {
        const memory = creep.memory || {};
        this.name = creep.name;
		this.creep = creep;
        this.task = memory.task ? memory.task : 'standby';
    }

    get(key) {
        return this.creep.memory[key];
    }

    set(key, value) {
        this.creep.memory[key] = value;
    }

    hasTask(task) {
        return this.task === task;
    }

    setTask(task, message = null) {
        if (message) this.creep.say(message);
        this.set('task', task);
    }

    isStandby() {
        return !this.task || this.hasTask('standby');
    }

    isEnergyEmpty() {
        return this.creep.store[RESOURCE_ENERGY] == 0;
    }

    isEnergyFull() {
        return this.creep.store.getFreeCapacity() == 0;
    }

    transfer(target) {
        if(this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            this.creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }

    harvest() {
        function getTarget(room) {
            const sources = room.find(FIND_SOURCES);
            const randomSource = sources.rand();
            if (randomSource) {
                return { room: room.name, _id: randomSource.id, obj: randomSource };
            }
            return null;
        }

        const targetableObject = Game.getObjectById(this.get('target'));

        let target;
        if (targetableObject) {
            target = { _id: targetableObject.id, creep: null, room: targetableObject.room, obj: targetableObject };
        }

        if (!target) {
            target = getTarget(this.creep.room);
            this.set('target', target && target._id);
        }

        if (this.creep.harvest(target.obj) === ERR_NOT_IN_RANGE) {
            const res = this.creep.moveTo(target.obj, {
                visualizePathStyle: { stroke: '#ffaa00' },
                // reusePath: 5, // default: 5
            });
            if (res !== 0) {
                // https://docs.screeps.com/api/#Creep.moveTo
                console.log(this.creep.name, 'moveTo', res);
            }
        }
    }

    clearMemory() {
        this.creep.memory = {};
    }
}

module.exports = BaseCreep;
