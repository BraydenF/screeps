const Drone = require('Drone.class');
const config = require('config');

const OUTFITS = {
  BASE_PARTS: [WORK, CARRY, CARRY, MOVE, MOVE], // 300
  SCOUT: [MOVE], // 50
  MINER: [MOVE, WORK, WORK], // 250
  UPGRADER: [WORK, CARRY, CARRY, MOVE], // 300
  HAULER: [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY], // 300
  SOLDIER: [ATTACK, ATTACK, MOVE, MOVE], // 260
  FLAGBEARER: [CLAIM, MOVE], // 650
};

const builds = {
  default: { cost: 300, parts: { work: 1, carry: 2, move: 2 } },
  upgrader: { cost: 300, parts: { work: 1, carry: 2, move: 2 } },
  scout: { cost: 50, parts: { move: 1 } },
  miner: { cost: 250, parts: { work: 2, move: 1 } },
  hauler: { cost: 300, parts: { move: 3, carry: 3 } },
  soldier: { cost: 260, parts: { attack: 2, move: 2 } },
  flagbearer: { cost: 650, parts: { claim: 1, move: 1 } },
};

const PART_PRIORITY = [TOUGH, WORK, ATTACK, CARRY, MOVE, RANGED_ATTACK, HEAL, CLAIM];

function getSortedParts(reciept) {
  const parts = [];
  PART_PRIORITY.forEach((part) => {
    if (reciept[part]) {
      for (let x = 0; x <= reciept[part]; x++) parts.push(part);
    }
  });
  return parts;
}

function selectParts(job, cost) {
  let remainingBudget = cost;
  let parts = {};

  if (builds[job] && remainingBudget >= builds[job].cost) {
    parts = builds[job].parts;
    remainingBudget = remainingBudget - builds[job].cost;
  }

  function addPart(part) {
    if (typeof parts[part] === 'undefined') {
      parts[part] = 1;
    } else {
      parts[part]++
    }
    remainingBudget = remainingBudget - BODYPART_COST[part];
  }

  if (job === 'miner' && remainingBudget >= 250) {
    while (remainingBudget >= 100 && parts.work < 6) {
      addPart(WORK);
    }

    while(remainingBudget >= 100) {
      addPart(CARRY);
      addPart(MOVE);
    }
  }
  else if (job === 'hauler') {
    while(remainingBudget >= 100) {
      addPart(CARRY);
      addPart(MOVE);
    }
  }
  else if (job === 'upgrader' && remainingBudget >= 300) {
    while (remainingBudget >= 100 && parts.work < 7) {
      addPart(WORK);
    }

    if (remainingBudget >= 50) addPart(CARRY);
    if (remainingBudget >= 50) addPart(CARRY);

    if (remainingBudget >= 50) addPart(MOVE);
    if (remainingBudget >= 50) addPart(MOVE);

  }
  else if (job === 'drone' && remainingBudget >= 300) {
    const baseSetsCount = Math.floor(remainingBudget / builds['default'].cost);

    parts.work = baseSetsCount * builds['default'].parts.work;
    parts.carry = baseSetsCount * builds['default'].parts.carry;
    parts.move = baseSetsCount * builds['default'].parts.move;

    remainingBudget = remainingBudget - (baseSetsCount * builds['default'].cost);

    // double productivity first
    if (remainingBudget >= 100) addPart(WORK);

    while(remainingBudget >= 100) {
      addPart(CARRY);
      addPart(MOVE);
    }

    if (remainingBudget >= 50) addPart(MOVE);
  }

  return parts;
}

function createDroneFactory(spawn) {
  if (typeof spawn === 'string') spawn = Game.spawns[spawn];

  return function(job = 'drone', input = 300, mem = {}) {
    const name = `${job}-${Game.time}-chan`;
    let reciept = {};
    let parts = [];

    if (typeof input === 'number') reciept = selectParts(job, input);
    else if (Array.isArray(input)) parts = input;
    else if (typeof input === 'object') reciept = input;

    if (parts.length === 0) {
      parts = getSortedParts(reciept);
    }

    let status = spawn.spawnCreep(parts, name, { dryRun: true });

    if (status === OK) {
      const memory = { role: 'drone', job: job, homeRoom: spawn.room.name, ...mem, };
      status = spawn.spawnCreep(parts, name, { memory });
      // console.log(`<b>Building:</b> ${job}:${input}`, status);
      // console.log('Parts:', reciept.parts);
    }

    return { status: status, name: status === OK ? name : null };
  }
}

module.exports = { createDroneFactory, selectParts };
