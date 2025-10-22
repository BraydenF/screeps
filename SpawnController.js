const config = require('config');
const droneService = require('drone.service');

const w5 = [WORK, WORK, WORK, WORK, WORK];
const m5 = [MOVE, MOVE, MOVE, MOVE, MOVE];
const m10 = [...m5, ...m5]; // 500
const c5 = [CARRY, CARRY, CARRY, CARRY, CARRY]; // 250
const a5 = [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK]; // 400
const a10 = [...a5, ...a5]; // 800
const h5 = [HEAL, HEAL, HEAL, HEAL, HEAL]; // 1250
const h10 = [...h5, ...h5]; // 2500

// const w10m5 = [...w5, ...w5, ...m5]; // cost 1250
// const w10m10 = [...w5, ...w5, ...m5, ...m5]; // cost 1500
// const w15m15 = [...w5, ...w5, ...w5, ...m5, ...m5, ...m5]; // cost 1800
const m2c2 = [MOVE, MOVE, CARRY, CARRY];
// const m5c5 = [...m5, ...c5]; // 250 capacity
// const m10c10 = [...c5, ...m5, ...c5, ...m5]; // 500 capacity

// there are a couple spawns, and I could add better spawn interactions.
// - finish moving spawning logic here
// - consider how to handle spawn requests instead of a single flag. Allow different systems to post requests, and the spawn can fullfill them individually.

class SpawnController {
  get name() {
    return this.spawn && this.spawn.name;
  }

  get spawning() {
    // todo: reduce all the spawns
    return this.spawn && this.spawn.spawning;
  }

  constructor(room, spawns) {
    this.room = room;
    // the primary spawn is the one closest to storage
    this.spawn = spawns.length <= 1 ? spawns[0] : room.storage.pos.findClosestByRange(FIND_MY_SPAWNS);
    this.spawns = spawns;

    this.spawns.forEach(spawn => {
      global[spawn.name] = {
        createDrone: droneService.createDroneFactory(spawn),
      };
    });
  }

  get(key) {
    return this.room.memory[key];
  }

  set(key, value) {
    this.room.memory[key] = value;
  }

  getSpawn() {
    // todo: update to return a non spawning spawn
    return this.spawn;
  }

  getNearestSpawn(pos) {
    if (pos.pos) pos = pos.pos;
    let spawn = this.spawn;
    if (this.spawns.length > 1) {
      spawn = pos.findClosestByRange(FIND_MY_SPAWNS, { filter: spawn => !spawn.spawning });
    }
    return spawn;
  }

  getNextSpawn() {
    return this.get('toSpawn');
  }

  setNextSpawn(creepDetails) {
    if (!this.spawn.spawning) {
      this.set('toSpawn', creepDetails);
    }
  }

  requestSpawn(key, details)  {
    const requestedSpawns = this.get('requestedSpawns');
    if (!requestedSpawns[key]) {
      requestedSpawns[key] = details;
    }
    if (!this.get('toSpawn')) this.set('toSpawn', details);
  }

  canSpawn(cost = null) {
    const energyAvailable = this.room.energyAvailable;
    const hasEnergy = cost ? energyAvailable >= cost : this.room.energyCapacityAvailable - energyAvailable === 0;
    return !this.spawn.spawning && hasEnergy;
  }

  spawnCreep() {
    const requestedSpawns = this.get('requestedSpawns') || {};
    let toSpawn = this.get('toSpawn');

    if (!toSpawn && Object.keys(requestedSpawns).length > 0) {
      let priority = 0;
      toSpawn = Object.keys(requestedSpawns).reduce((acc, key) => {
        if ((requestedSpawns[key].priority || 0) >= priority) {
          priority = (requestedSpawns[key].priority || 0);
          delete requestedSpawns[key].priority;
          acc = requestedSpawns[key];
        }
        return acc;
      }, null);
    }

    const spawn = toSpawn.spawn ? Game.getObjectById(toSpawn.spawn) : this.spawn;
    if (toSpawn && Game.time % 3 === 0 && !spawn.spawning) {
      const res = this.createDrone(toSpawn.job, toSpawn.body || toSpawn.cost, toSpawn.memory);
      // console.log(this.getSpawn().name, toSpawn.job, toSpawn.body, res.status);

      if (res.status === OK) {
        this.set('toSpawn', undefined);
      } else if (res.status === ERR_NOT_ENOUGH_ENERGY && this.room.energyCapacityAvailable === this.room.energyAvailable) {
        this.set('toSpawn', null);
        return ERR_NOT_ENOUGH_ENERGY;
      }

      return res.status;
    }
  }

  createDrone(job, cost, memory) {
    // will need to be replaced to something that allows for dynamic spawn selection
    let spawn = this.spawn;

    if (spawn.spawning && this.spawns[1] && !this.spawns[1].spawning) {
      spawn = this.spawns[1];
    }

    const createDrone = droneService.createDroneFactory(spawn);
    if (typeof cost === 'number') cost = droneService.selectParts(cost);
    return createDrone(job, cost, memory);
  }

  spawnDrone(cost = 300, memory) {
    let body = [WORK, MOVE, MOVE, CARRY, CARRY]; // 300

    if (cost >= 1300) body = [...w5, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
    else if (cost >= 1100) body = [...w5, ...m2c2, ...m2c2, ...m2c2];
    else if (cost >= 800) body = [WORK, WORK, WORK, WORK, ...m2c2, ...m2c2];
    else if (cost >= 500) body = [...body, ...body];

    const createDrone = droneService.createDroneFactory(this.spawn);
    return createDrone('drone', body, memory);
  }

  spawnHauler(energyLimit = 300, memory = {}, instantSpawn) {
    if (!this.getNextSpawn()) {
      let body = [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY];

      if (energyLimit >= 2000)      body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 1800) body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 1600) body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 1400) body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 1200) body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 1000) body = [...m2c2, ...m2c2, ...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 800)  body = [...m2c2, ...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 600)  body = [...m2c2, ...m2c2, ...m2c2];
      else if (energyLimit >= 400)  body = [...m2c2, ...m2c2];

      if (instantSpawn) {
        return this.createDrone('hauler', body, memory);
      } else {
        this.setNextSpawn({ job: 'hauler', body: body, memory });
      }
    }
  }

  spawnUpgrader() {
    if (!this.getNextSpawn()) {
      const cost = this.room.energyCapacityAvailable < 1100 ? this.room.energyCapacityAvailable : 1100;
      let body = [WORK, ...m2c2];
      const sourceIds = Object.keys(this.get('sources') || {});

      if (cost >= 1400) body = [...w5, ...w5, ...m2c2, CARRY, CARRY, CARRY];
      else if (cost >= 1100) body = [...w5, WORK, WORK, WORK, ...m2c2, CARRY, MOVE];
      else if (cost >= 1000) body = [...w5, WORK, WORK, ...m2c2, CARRY, MOVE];
      else if (cost >= 800) body = [...w5, WORK, ...m2c2];
      else if (cost >= 700) body = [...w5, ...m2c2];
      else if (cost >= 500) body = [WORK, WORK, WORK, ...m2c2];
      else if (sourceIds && sourceIds.length === 1) body = [...w5, ...m2c2];

      this.setNextSpawn({ job: 'upgrader', body });
    }
  }

  reclaimCreep(targetId) {
    const toRecycle = Game.getObjectById(targetId);
    if (toRecycle) this.spawn.recycleCreep(toRecycle);
  }

  rechargeCreeps(nearbyCreep = null) {
    nearbyCreep = !nearbyCreep && this.spawn.pos.findInRange(FIND_MY_CREEPS, 1, {
      filter: (creep) => {
        const isBoosted = creep.body.reduce((acc, part) => creep.boost || acc, false);
        return creep.ticksToLive <= 1400 && creep.getActiveBodyparts(CLAIM) === 0 && !isBoosted;
      }
    });
    if (nearbyCreep) {
      const rechargeAttempt = this.spawn.renewCreep(nearbyCreep);

      if (rechargeAttempt === OK && nearbyCreep.memory.task === 'recharge' && nearbyCreep.ticksToLive >= 1400) {
        nearbyCreep.memory.task = 'standby';
      }
    }
  }
}

module.exports = SpawnController;
