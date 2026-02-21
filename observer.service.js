const config = require('config');
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
  observeRoom: function(myroom, observer) {
    const status = observer.observeRoom(room);
    if (status === OK) {
      room.memory.observableRoom = room;
    } else {
      room.memory.observableRoom = null;
    }
  },
  scanRoom: function (myRoom, observableRoom) {
    if (!observableRoom) return console.log(Game.time, 'observableRoom not found');

    // searches for deposits when not mining
    if (!myRoom.memory['mining-deposit']) {
      if (!myRoom.memory.deposits) myRoom.memory.deposits = {};
      observableRoom.find(FIND_DEPOSITS).forEach(deposit => {
        if (deposit.lastCooldown < 85) {
          let mem = myRoom.memory.deposits[deposit.id] || {};
          const hostiles = deposit.pos.findInRange(FIND_HOSTILE_CREEPS, 2);

          if (hostiles.length > 0) {
            mem.disabled = true;
          } else if (mem.contested && Game.time - mem.contested >= 3500) {
            mem.disabled = false;
            mem.contested = undefined;
          }

          const walkablePositions = GameMap.getWalkablePositions(deposit.pos);
          myRoom.memory.deposits[deposit.id] = {
            ...mem,
            id: deposit.id,
            depositType: deposit.depositType,
            lastCooldown: deposit.lastCooldown,
            expectedDecay: Game.time + deposit.ticksToDecay,
            room: observableRoom.name,
            walkablePositions: walkablePositions.length,
          }
        }
      });
    }

    if (!Memory.powerBanks) Memory.powerBanks = {};
    const powerBanks = observableRoom.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK} });

    powerBanks.forEach(powerBank => {
      const mem = Memory.powerBanks[powerBank.id];
      if (mem) {
        mem.hits = powerBank.hits;
        mem.hostiles = powerBank.pos.findInRange(FIND_HOSTILE_CREEPS, 5).length;
        Memory.powerBanks[powerBank.id] = mem;
      } else if (powerBank.power > 1100) {
        const walkablePositions = GameMap.getWalkablePositions(powerBank.pos);
        if (walkablePositions.length >= 2) {
          Memory.powerBanks[powerBank.id] = {
            id: powerBank.id,
            hits: powerBank.hits,
            power: powerBank.power,
            expectedDecay: Game.time + powerBank.ticksToDecay,
            room: observableRoom.name,
            primaryRoom: myRoom.name,
            walkablePositions: walkablePositions.length,
            hostiles: powerBank.pos.findInRange(FIND_HOSTILE_CREEPS, 5).length,
            squad: [],
          }
        }
      }
    });
  },
  scanObservableRooms: function(observer) {
    const room = Game.rooms[observer.pos.roomName];
    const roomConfig = config.rooms[observer.pos.roomName] || {};

    if (roomConfig.observerRooms) {
      if (room.memory.observableRoom) {
        observerService.scanRoom(room, Game.rooms[room.memory.observableRoom]);
        room.memory.observableRoom = null;
      }

      if (Game.time % 2 === OK) {
        const roomName = roomConfig.observerRooms.rand();
        const targetRoom = Game.rooms[roomName];
        // console.log(roomName, targetRoom);

        if (targetRoom) {
          observerService.scanRoom(room, targetRoom);
          // I guess I could use this to make free scans in the midst of scanning hallways...
        } else {
          // observerService.observeRoom(room, observer);
          const status = observer.observeRoom(roomName);
          if (status === OK) {
            room.memory.observableRoom = roomName;
          } else {
            room.memory.observableRoom = null;
          }
        }
      }
    }
  },
  run: function(observer) {
    // let cpu = Game.cpu.getUsed();
    // oberserver modes or plans
    // - hallway-scan: scan hallways for deposits and power banks
    // - nuker-scan: identify and prepare for armed nukers
    // - 

    const mem = Memory.rooms[observer.pos.roomName];
    observerService.scanObservableRooms(observer);

    // console.log('observer-cpu', (Game.cpu.getUsed() - cpu).toFixed(3));
  }
}

module.exports = observerService;
