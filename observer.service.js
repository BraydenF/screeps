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

    const hostileStructs = observableRoom.find(FIND_HOSTILE_STRUCTURES);

    hostileStructs.forEach(hostileStruct => {
      if (hostileStruct.structureType === STRUCTURE_POWER_BANK) {
        if (!myRoom.memory.powerBank && hostileStruct.power >= 1000 && hostileStruct.ticksToDecay > 1000) {
          myRoom.memory.powerBank = {
            id: hostileStruct.id,
            hits: hostileStruct.hits,
            power: hostileStruct.power,
            expectedDecay: Game.time + hostileStruct.ticksToDecay,
            room: observableRoom.name,
          }
        }
      }
    });

    if (hostileStructs.length === 0 && myRoom.memory.powerBank && myRoom.memory.powerBank === observableRoom) {
      myRoom.memory.powerBank = undefined;
    }
  },
}

module.exports = observerService;
