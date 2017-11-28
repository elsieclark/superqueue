'use strict';
const _ = require('lodash');

const Err = require('./error.service');

module.exports = {
    number: (object, name, def, min, max) => {
        const value = _.get(object, name, def);
        if (!_.isFinite(value)) {
            throw Err(`${name} option is not a valid number; got '${value}'.`);
        }
        if (_.isFinite(min) && value < min) {
            throw Err(`${name} option must be at least ${min}; got '${value}'.`);
        }
        if (_.isFinite(max) && value > max) {
            throw Err(`${name} option must be at most ${max}; got '${value}'.`);
        }
        return value;
    },

    int: (value, name, def, min, max) => {
        return Math.floor(this.validNumber(value, name, def, min, max));
    },

    flagArr: (arr, flags) => {
        if (_.isUndefined(arr)) {
            return [];
        }
        if (!_.isArray(funcOptions.flags)) {
            throw Err(`"flags" property provided to '.push()' must be an array. Got: '${funcOptions.flags}'.`);
        }
        return _.forEach(arr, (flagName) => {
            if (!_.isString(flagName) && !_.isSymbol(flagName)) {
                throw Err(`Flag '${flagName}' provided to '.push()' is not a valid flag name. The flag name
                        must be either a String or a Symbol`);
            }
            if (!flags[flagName]) {
                throw Err(`Flag '${flagName}' provided to '.push()' has not been registered with the queue`);
            }
        });
    },

    key: (value, name, def) => {
        if (_.isUndefined(value)) {
            return def;
        }
        if (!_.isString(value) && !_.isSymbol(value)) {
            throw Err(`${name} option must be a valid key (String or Symbol); got '${value}'.`);
        }
        return value;
    },
};
