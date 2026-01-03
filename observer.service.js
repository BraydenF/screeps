const GameMap = require('GameMap');

const observerService = {
  getObserver: function (room) {
    let observer = room.memory.observer && Game.getObjectById(room.memory.observer);
    if (!observer) {
      observer = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_OBSERVER } }).onFirst(f => f);
      if (observer) {
        room.memory.observer = observer.id;
      }
    }
    return observer;
  },
  createRoomCycler: function (rooms = []) {
    let i = 0;
    return { getRoom: () => rooms[i++ % rooms.length] || null };
  },
  scanRoom: function (myRoom, observableRoom) {
    if (!observableRoom) return console.log(Game.time, 'observableRoom not found');

    // searches for deposits when not mining
    if (!myRoom.memory['mining-deposit']) {
      if (!myRoom.memory.deposits) myRoom.memory.deposits = {};
      observableRoom.find(FIND_DEPOSITS).forEach(deposit => {
        if (deposit.lastCooldown < 85) {
          myRoom.memory.deposits[deposit.id] = {
            ...myRoom.memory.deposits[deposit.id],
            id: deposit.id,
            depositType: deposit.depositType,
            lastCooldown: deposit.lastCooldown,
            expectedDecay: Game.time + deposit.ticksToDecay,
            room: observableRoom.name,
          }
        }
      });
    }

    if (!myRoom.memory.powerBank) {
      const powerBanks = observableRoom.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK} });
      powerBanks.forEach(powerBank => {
        if (powerBank.hits === powerBank.hitsMax && powerBank.power >= 1000 && powerBank.ticksToDecay > 4000) {
          const walkablePositions = GameMap.countWalkablePositions(powerBank.pos);
          if (walkablePositions >= 2) {
            myRoom.memory.powerBank = {
              id: powerBank.id,
              hits: powerBank.hits,
              power: powerBank.power,
              expectedDecay: Game.time + powerBank.ticksToDecay,
              room: observableRoom.name,
              walkablePositions,
            } 
          }
        }
      });
    } else if (myRoom.memory.powerBank.room === observableRoom) {
      const bank = Game.getObjectById(myRoom.memory.powerBank.id);
      if (bank) {
        const hostiles = bank.pos.findInRange(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
          myRoom.memory.powerBank = undefined;  
        }
      } else {
        myRoom.memory.powerBank = undefined;
      }
    }
  },
}

module.exports = observerService;
