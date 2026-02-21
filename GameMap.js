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
          if (type === 'rampart' && result.structure.owner.username !== Game.username) {
            return false;  // Enemy rampart blocks
          }
          break;
      }
    }
    return true;
  }

  static getWalkablePositions(pos) {
    const adjPositions = [];

    for (let dx = -1; dx <= 1; ++dx) {
      for (let dy = -1; dy <= 1; ++dy) {
        if (dx === 0 && dy === 0) continue;
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (x < 0 || x > 49 || y < 0 || y > 49) continue;

        const adjPos = new RoomPosition(x, y, pos.roomName);
        if (GameMap.isWalkable(adjPos)) {
          adjPositions.push(adjPos);
        }
      }
    }

    return adjPositions;
  }

  // consider updating to findNearbyHive to justify max distance for purposes
  static findNearestHive(roomName) {
    let minDistance = Infinity;
    let closestHive = null;

    for (const hiveName in global.hives) {
      const hive = global.hives[hiveName];
      if (hive.room.controller.level >= 7) {
        const distance = Game.map.getRoomLinearDistance(roomName, hive.room.name, false);

        if (distance < minDistance) {
          minDistance = distance;
          closestHive = hive;
        }
      }
    }

    return closestHive;
  } 

  static isHighway(roomName) {
    let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
    return (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
  }

  static isCrossroad(roomName) {
    const match = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/);
    if (!match) return false;
    const x = parseInt(match[2], 10);
    const y = parseInt(match[4], 10);
    return x % 10 === 0 && y % 10 === 0;
  }

  static findRoute(fromRoom, toRoom) {
    if (!Memory._routes) Memory._routes = {};
    const routeKey = `${fromRoom}-${toRoom}`;

    if (Memory._routes[routeKey]) {
      return Memory._routes[routeKey];
    }

    const route = Game.map.findRoute(fromRoom, toRoom, {
      routeCallback(roomName) {
        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        if (!parsed) return 1; // safety for non-standard room names

        const x = parseInt(parsed[1], 10);
        const y = parseInt(parsed[2], 10);
        const isHighway = (x % 10 === 0) || (y % 10 === 0);
        const isMyRoom = Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller.my || false;

        if (isHighway || isMyRoom) return 1;
        const roomsToAvoid = config.roomsToAvoid[Game.shard.name];
        if (roomsToAvoid.includes(roomName)) return Infinity;
        return 4;
      }
    });

    Memory._routes[routeKey] = route;
    return route;
  }

  static findPortalPath(myPos, targetShard) {
    const portals = Memory.portals;
    if (portals) {
      // I have portals in memory, can I create a path from my position to the desired shard. 
    }
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

  static findNearestCrossroad(roomName) {
    const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName);
    if (!parsed) return null; // invalid room name

    const [_, xSign, xStr, ySign, yStr] = parsed;
    const x = parseInt(xStr, 10);
    const y = parseInt(yStr, 10);

    // Calculate the four nearest crossroads by snapping to nearest 10s in each direction
    const candidates = [];

    // Northwest-ish: round down x, round up y (depending on signs)
    const nwX = x - (x % 10);
    const nwY = y + (10 - (y % 10));
    candidates.push(`${xSign}${nwX}${ySign}${nwY}`);

    // Northeast-ish: round up x, round up y
    const neX = x + (10 - (x % 10));
    const neY = y + (10 - (y % 10));
    candidates.push(`${xSign}${neX}${ySign}${neY}`);

    // Southwest-ish: round down x, round down y
    const swX = x - (x % 10);
    const swY = y - (y % 10);
    candidates.push(`${xSign}${swX}${ySign}${swY}`);

    // Southeast-ish: round up x, round down y
    const seX = x + (10 - (x % 10));
    const seY = y - (y % 10);
    candidates.push(`${xSign}${seX}${ySign}${seY}`);

    // Remove duplicates (happens when already on a highway or crossroad)
    const uniqueCandidates = [...new Set(candidates)];

    // Filter out the current room if it's already a crossroad
    const filtered = uniqueCandidates.filter(r => r !== roomName);

    if (filtered.length === 0) {
        // Current room is already a crossroad
        return roomName;
    }

    // Calculate route length to each candidate
    const distances = {};
    for (const candidate of filtered) {
        const route = Game.map.findRoute(roomName, candidate);
        distances[candidate] = route === ERR_NO_PATH ? Infinity : route.length;
    }

    // Find the one with shortest route
    let nearest = null;
    let minLength = Infinity;

    for (const room of filtered) {
        const len = distances[room];
        if (len < minLength) {
            minLength = len;
            nearest = room;
        }
    }

    return nearest || null; // null if somehow no valid path (very rare)
}

  static buildRoad(room, from, to) {
    console.log('building road', from, to);
    PathFinder.search(from, { pos: to.pos, range: 1 }, { plainCost: 1, swampCost: 2 }).path.forEach(pos => {
      room.createConstructionSite(pos, STRUCTURE_ROAD);
    });
  }

  static scan(roomName = null) {
    const map = Memory.map || {};
    const roomNames = roomName ? [roomName] : Object.keys(Game.rooms);
    const highways = map.highways || {};
    let data = {};

    // checks all visible rooms and stores information about them.
    roomNames.forEach(roomName => {
      const room = Game.rooms[roomName];
      if (room) {
        if (GameMap.isHighway(roomName)) {
          const highway = highways[roomName] || {};
          if (GameMap.isCrossroad(roomName)) {
            if (!Memory.portals) Memory.portals = {};
            const portals = room.find(FIND_STRUCTURES, {
              filter: s => s.structureType === STRUCTURE_PORTAL && s.destination && s.destination.shard
            });

            if (portals.length > 0) {
              data.portals = portals;
              for (const portal of portals) {
                Memory.portals[portal.id] = {
                  id: portal.id,
                  destination: portal.destination,
                  ticksRemaining: portal.ticksRemaining,
                };
              }
            }

            // return { portals };
          } else {
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
          }

          // todo: PowerBank info

        } else {
          map[roomName] = {};
          // if (room.controller && room.controller.owner) {
          //   map[roomName].owner = room.controller.owner;
          // }

          if (room.controller && room.controller.reservation) {
            map[roomName].reservedBy = room.controller.reservation.username;
            map[roomName].reservedEol = Game.time + room.controller.reservation.ticksToLive;

            if (map[roomName].reservedBy === 'Invader' || map[roomName].reservedBy === Game.username) {
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

    return data;
  }

  constructor() {
    this.map = Memory.map;
  }

  setMap(map) {
    this.map = map;
    Memory.map = map;
  }
}

global.GameMap = GameMap;
module.exports = GameMap;
