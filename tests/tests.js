'use strict';
const _     = require('lodash');
const Queue = require('../lib/index.js');


const queue = new Queue(1);
const startTime = Date.now();

const thennable = (wait, msg) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log(msg, Date.now() - startTime);
            resolve();
        }, wait);
    });
};

queue.push(thennable, 1000, 'Item1')
    .then(() => {
        console.log(queue.getLength());
    });
queue.push(thennable, 2000, 'Item2')
    .then(() => {
        console.log(queue.getLength());
    });
queue.push(thennable, 3000, 'Item3')
    .then(() => {
        console.log(queue.getLength());
    });
queue.push(thennable, 4000, 'Item4')
    .then(() => {
        console.log(queue.getLength());
    });

