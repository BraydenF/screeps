const DEFAULT_NOTIFIER = { 
  resourceCounters: {},
  lastNotificationTimestamp: 0,
  notificationHistory: []
};

const productionNotifier = {
  getCounters() {
    if (!Memory._notifier) Memory._notifier = DEFAULT_NOTIFIER;
    return Memory._notifier.resourceCounters;
  },

  incrementCounter(key, value) {
    const counters = productionNotifier.getCounters();
    if (!counters[key]) {
      counters[key] = 0;
    }
    counters[key] += value;
    Memory._notifier.resourceCounters = counters;
  },

  getLastNotificationTime() {
    if (!Memory._notifier) Memory._notifier = DEFAULT_NOTIFIER;
    return Memory._notifier.lastNotificationTimestamp;
  },

  shouldSendNotification() {
    const lastTime = productionNotifier.getLastNotificationTime();
    const currentTime = Date.now();
    const hoursSinceLastNotification = (currentTime - lastTime) / (1000 * 60 * 60);
    return hoursSinceLastNotification >= 24 || lastTime === 0;
  },

  sendDailyNotification() {
    const counters = productionNotifier.getCounters();
    
    if (Object.keys(counters).length === 0) {
      console.log('No resource data to report');
      return;
    }

    let message = 'Daily Resource Report\n';
    message += new Date().toLocaleString() + '\n';
    message += '---\n';
    
    for (const [resource, amount] of Object.entries(counters)) {
      message += resource + ': ' + amount.toLocaleString() + '\n';
    }

    message += '---\n';

    Game.notify(message);
    console.log(message);

    if (!Memory._notifier.notificationHistory) {
      Memory._notifier.notificationHistory = [];
    }

    Memory._notifier.notificationHistory.push({
      timestamp: Date.now(),
      data: { ...counters },
    });

    if (Memory._notifier.notificationHistory.length > 7) {
      Memory._notifier.notificationHistory.shift();
    }

    Memory._notifier.resourceCounters = {};
    Memory._notifier.lastNotificationTimestamp = Date.now();

    console.log('Daily notification sent and counters flushed');
  },

  getHistory() {
    if (!Memory._notifier) Memory._notifier = DEFAULT_NOTIFIER;
    return Memory._notifier.notificationHistory || [];
  },

  run () {
    if (Game.time % 3333 === OK && productionNotifier.shouldSendNotification()) {
      productionNotifier.sendDailyNotification();
    }
  },

  reset() {
    Memory._notifier = DEFAULT_NOTIFIER;
    console.log('Resource counter system reset');
  }
};

module.exports = productionNotifier;