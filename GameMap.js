const config = require('config');

class GameMap {
  static getRoom() {

  }

  static isRoomOccupied(roomName) {

  }

  static isHighway(roomName) {
    let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
    return (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
  }

  static findRoute(fromRoom, toRoom) {
    return Game.map.findRoute(fromRoom, toRoom, {
      routeCallback(roomName) {
        let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
        let isMyRoom = Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller.my;

        if (isHighway || isMyRoom) {
          return 1;
        } else if (config.roomsToAvoid.includes(roomName)) {
          return 99;
        } else {
          return 1;
        }
      }
    });
  }

  static findNearestHallway(roomName) {
    let parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
    let [rn, xHeading, x, yHeading, y] = parsed;

    const northernHighway = `${xHeading}${x}${yHeading}${Number(y) + (10 - (y % 10))}`;
    const southernHighway = `${xHeading}${x}${yHeading}${Number(y) - (Number(y) % 10)}`;
    const westernHighway = `${xHeading}${Number(x) + (10 - (x % 10))}${yHeading}${y}`;
    const easternHighway = `${xHeading}${Number(x) - (Number(x) % 10)}${yHeading}${y}`;

    const distances = {
      [northernHighway]: GameMap.findRoute(roomName, northernHighway).length,
      [southernHighway]: GameMap.findRoute(roomName, southernHighway).length,
      [westernHighway]: GameMap.findRoute(roomName, westernHighway).length,
      [easternHighway]: GameMap.findRoute(roomName, easternHighway).length,
    }

    return Object.keys(distances).reduce((acc, hall) => {
      return distances[hall] < distances[acc] ? hall : acc;
    }, northernHighway);
  }

  static buildRoad(room, from, to) {
    console.log('building road', from, to);
    PathFinder.search(from, { pos: to.pos, range: 1 }, { plainCost: 1, swampCost: 2 }).path.forEach(pos => {
      room.createConstructionSite(pos, STRUCTURE_ROAD);
    });
  }

  static scan(roomName = null) {
    const map = Memory.map;
    const roomNames = roomName ? [roomName] : Object.keys(Game.rooms);
    const highways = map.highways || {};

    // checks all visible rooms and stores information about them.
    roomNames.forEach(roomName => {
      const room = Game.rooms[roomName];
      if (room) {
        if (GameMap.isHighway(roomName)) {
          const highway = highways[roomName] || {};

          // if (!highway.admin) {
          //   let distance = 10;
          //   const nearestRoom = Object.keys(Memory.rooms).reduce((acc, myRoomName) => {
          //     const myRoom = Game.rooms[myRoomName];
          //     if (myRoom && myRoom.controller && myRoom.controller._my && myRoom.controller.level >= 6) {
          //       console.log(room.name);
          //       const route = GameMap.findRoute(roomName, myRoomName);
          //       if (route && route.length < distance) {
          //         distance = route.length;
          //         return myRoomName
          //       } else {
          //         return acc;
          //       }
          //     }
          //     return acc;
          //   }, null);
          //   if (nearestRoom) {
          //     highway.admin = nearestRoom; 
          //   }
          //   highways[roomName] = highway;
          // }

          // const adminRoom = highway.admin && Game.rooms[highway.admin];
          // if (adminRoom) {
          //   // if (!adminRoom.memory.deposits) adminRoom.memory.deposits = {};
          //   // room.find(FIND_DEPOSITS).forEach(deposit => {
          //   //   if (deposit.lastCooldown < 100) {
          //   //     adminRoom.memory.deposits[deposit.id] = {
          //   //       ...adminRoom.memory.deposits[deposit.id],
          //   //       id: deposit.id,
          //   //       depositType: deposit.depositType,
          //   //       lastCooldown: deposit.lastCooldown,
          //   //       expectedDecay: Game.time + deposit.ticksToDecay,
          //   //       room: roomName,
          //   //     }
          //   //   } else if (deposit.lastCooldown >= 100) {
          //   //     adminRoom.memory.deposits[deposit.id] = undefined;
          //   //   }
          //   // });
          // }

          // todo: PowerBank info
          // todo: Teleporter info

        } else {
          map[roomName] = {};
          // if (room.controller && room.controller.owner) {
          //   map[roomName].owner = room.controller.owner;
          // }

          if (room.controller && room.controller.reservation) {
            map[roomName].reservedBy = room.controller.reservation.username;
            map[roomName].reservedEol = Game.time + room.controller.reservation.ticksToLive;

            if (map[roomName].reservedBy === 'Invader' || map[roomName].reservedBy === 'Broden1616') {
              room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } }).onFirst(invaderCore => {
                map[roomName].invaderCore = {
                  id: invaderCore.id,
                  eol: Game.time + invaderCore.effects[0].ticksRemaining,
                };
              });
            }
          }
        }
      }
    });

    map.highways = highways;
    Map.map = map;
  }

  constructor() {
    this.map = Memory.map;
  }

  getRooms() {
    return Object.keys(this.map);
  }

  setMap(map) {
    this.map = map;
    Memory.map = map;
  }
}

module.exports = GameMap;
