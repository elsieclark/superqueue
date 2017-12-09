'use strict';
const _            = require('lodash');
const Queue        = require('../lib/index.js');
const QueueItem     = require('./helpers/queueItem.js');

// Test 1:

let queue = new Queue({ interval: 1000 });
queue.addFlag({name: 'test', interval: 10000})
let queueItems = QueueItem(queue, 4);

Promise.resolve()
    .then(() => {
        //queueItems.pushAll();
        queueItems[0].push({ flags: ['test'] });
        queueItems[1].push();
        queueItems[2].push({ flags: ['test'] });
        console.log(queue.getLength(), queue.getConcurrent());
        queueItems[0].resolve();
        console.log('Resolving 0')
        return queueItems[0].waitFor('finished');
    })
    .then(() => {
        console.log(queueItems[0].isResolved())
        console.log(queueItems[0].isRejected())
        console.log(queue.getLength())
        console.log(queueItems[0].isExecuting())
        console.log(queueItems[1].isExecuting())
        console.log(queue.getLength(), queue.getConcurrent());
        return queueItems[1].waitFor('executed');
    })
    .then(() => {
        console.log(queueItems[1].isResolved())
        console.log(queueItems[1].isRejected())
        console.log(queue.getLength())
        console.log(queueItems[1].isExecuting())
        console.log(queueItems[2].isExecuting())
        setTimeout(() => {
            console.log('\n\n\nResolving 1')
            console.log(queue.getLength(), queue.getConcurrent());
            queueItems[1].resolve();
        }, 0);
        return queueItems[1].waitFor('finished');
    })
    .then(() => {
        console.log(queueItems[1].isResolved())
        console.log(queue.getLength(), queue.getConcurrent());
        return queueItems[2].waitFor('executed');
    })
    .then(() => {
        console.log(queueItems[2].isExecuting())
        console.log(queue.getLength(), queue.getConcurrent());
    })
    .catch((err) => {
        console.log(err);
    })

