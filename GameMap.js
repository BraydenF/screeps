const config = require('config');

const OBSTACLE_STRUCT_TYPES = [
  'spawn', 'extension', 'link', 'storage', 'tower', 'observer',
  'powerSpawn', 'powerBank', 'lab', 'terminal', 'nuker', 'factory', 'invaderCore',
  'constructedWall'
];

class GameMap {
  static isWalkable(pos) {
    const lookResults = pos.look();
    for (const result of lookResults) {
      switch (result.type) {
        case 'terrain':
          if (result.terrain === 'wall') return false;
          break;
        case 'creep':
        case 'powerCreep':
          return false;  // Currently occupied
        case 'source':
        case 'mineral':
        case 'deposit':
        case 'controller':
          return false;  // Impassable
        case 'structure':
          const type = result.structure.structureType;
          if (OBSTACLE_STRUCT_TYPES.includes(type)) return false;
          if (type === 'rampart' && result.structure.owner.username !== config.username) {
            return false;  // Enemy rampart blocks
          }
          break;
      }
    }
    return true;
  }

  static countWalkablePositions(pos) {
    let openSpots = 0;
    const adjPositions = [];

    for (let dx = -1; dx <= 1; ++dx) {
      for (let dy = -1; dy <= 1; ++dy) {
        if (dx === 0 && dy === 0) continue;
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (x < 0 || x > 49 || y < 0 || y > 49) continue;

        const adjPos = new RoomPosition(x, y, pos.roomName);
        if (GameMap.isWalkable(adjPos)) {
          openSpots++;
          adjPositions.push(adjPos);
        }
      }
    }

    return openSpots;
  }

  static isHighway(roomName) {
    let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
    return (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
  }

  static findRoute(fromRoom, toRoom) {
    if (!Memory._routes) Memory._routes = {};
    const routeKey = `${fromRoom}-${toRoom}`;

    if (Memory._routes[routeKey]) {
      return Memory._routes[routeKey];
    }

    const route = Game.map.findRoute(fromRoom, toRoom, {
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

    Memory._routes[routeKey] = route;
    return route;
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

            if (map[roomName].reservedBy === 'Invader' || map[roomName].reservedBy === config.username) {
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

  setMap(map) {
    this.map = map;
    Memory.map = map;
  }
}

module.exports = GameMap;
