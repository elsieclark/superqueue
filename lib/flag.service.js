'use strict';
const Err   = require('./error.service');
const Valid = require('./validate.service');


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
        if (flagName === undefined) {
            return flags[defaultFlag];
        }
        if (flags[flagName] !== undefined) {
            return flags[flagName];
        }
        throw Err(`No flag named '${flagName}'. Cannot access.`);
    },

    findUnlockTime: (flag) => {
        if (flag.paused || flag.concurrent >= flag.concurrency) {
            return Infinity;
        }
        const intervalConstraint = flag.recent.length ? Math.max(...flag.recent) + flag.interval : 0;
        // If not enough items have been sent to fill the queue even once
        if (!flag.rate || flag.recent.length < flag.rate) {
            return intervalConstraint;
        }
        const rateConstraint = Math.min(...flag.recent) + flag.rateDenominator;
        return Math.max(intervalConstraint, rateConstraint);
    },

    updateForExecutionStart: (flag) => {
        const startTime = Date.now();
        flag.concurrent++;
        flag.length--;
        if (flag.recent.length < flag.rate) {
            return flag.recent.push((startTime));
        }
        flag.recent[flag.recent.indexOf(Math.min(...flag.recent))] = startTime;
    },

    updateForExecutionFinish: (flag) => {
        flag.concurrent--;
    },
};