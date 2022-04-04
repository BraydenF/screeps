
const utils = {
    roll: function() {
        return Math.floor(Math.random() * 100);
    },
    getRandomSource: function (sources) {
        const target = [utils.roll() < 50 ? 1 : 0];
        return target.id;
    },
};

module.exports = utils;
