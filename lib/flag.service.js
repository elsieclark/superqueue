'use strict';
const _ = require('lodash');

const Err = require('./error.service');

module.exports = {
    init: (flags, flagName, options) => {
        flags[flagName] = {
            concurrency: Valid.int(options, 'concurrency', 1, 1),
            interval: Valid.number(options, 'interval', 0, 0),
            rate: Valid.int(options, 'rate', 0, 0),
            rateDenominator: Valid.number(options, 'rateDenominator', 1000, 0.001),
            concurrent: 0,
            length: 0,
            paused: false,
            recent: [],
        };
    },

    get: (flags, flagName, defaultFlag) => {
        if (_.isUndefined(flagName)) {
            return flags[defaultFlag];
        }
        if (_.has(flags, flagName)) {
            return flags[flagName];
        }
        throw Err(`No flag named '${flagName}'. Cannot access.`);
    },

    findUnlockTime: (flag) => {
        if (flag.paused || flag.concurrent >= flag.concurrency) {
            return Infinity;
        }
        const intervalConstraint = flag.recent.length ? _.max(flag.recent) + flag.interval : 0;
        // If not enough items have been sent to fill the queue even once
        if (!flag.rate || flag.recent.length < flag.rate) {
            return intervalConstraint;
        }
        const rateConstraint = _.min(flag.recent) + flag.rateDenominator;
        return Math.max(intervalConstraint, rateConstraint);
    },

    updateForExecutionStart: (flag) => {
        const startTime = Date.now();
        flag.concurrent++;
        flag.length--;
        if (flag.recent.length < flag.rate) {
            return flag.recent.push((startTime));
        }
        flag.recent[_.indexOf(flag.recent, _.min(flag.recent))] = startTime;
    },

    updateForExecutionFinish: (flag) => {
        flag.concurrent--;
    },
};