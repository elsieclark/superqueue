# superqueue

The only asynchronous promise queue you'll ever need. Very simple to use, and you can optionally configure concurrency, rate, interval, priority, and more.

Installation
------------

```sh
$ npm install --save superqueue
```

Usage
-----

Always start by requiring the package.

```js
const SuperQueue = require('superqueue');
```

### Simple Single Concurrency Queue ###

Create a simple promise queue with a concurrency of one (i.e. only one function is executing at a time).

```js
const SuperQueue = require('superqueue');

const myQueue = new SuperQueue();

function basicThennableFunction(param1) {
    return new Promise((resolve, reject)) {
        basicAsyncFunction((err, data) => {
            console.log(param1);
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    }
}

// Add thennable to queue
myQueue.push(basicThennableFunction, 'One')
    // This 'then' will be called after the function clears the queue
    .then((data) => {
        // Use the data
    })
    .catch((err) => {
        // Handle the error
    })

myQueue.push(basicThennableFunction, 'Two');
myQueue.push(basicThennableFunction, 'Three');

// Console output: 'One', 'Two', 'Three'
```

### Simple Adjustable Concurrency Queue ###

If you want to limit the number of concurrent requests being made, but one at a time is too slow, you can adjust the SuperQueue's concurrency. In order to create a SuperQueue where a maximum of 5 requests are being made at once, do the following:

```js
const SuperQueue = require('superqueue');

const myQueue = new SuperQueue(5);
```

That's it. Everything else works the same.

### Advanced Queue Configuration: Interval and Rate ###

A SuperQueue can also optionally be configured with an interval and/or a rate, which can be useful if you're hitting a rate limited API. There is a subtle difference between the two.

* The interval is the amount of time (in ms) that must pass between queued items being executed.
* The rate is the number of requests which can be made in any given second.

So what's the difference between, an interval of 200 and a rate of 5?  If you have 10 requests in the Queue and the interval is 200, one queued item will be executed every 200ms for 2s (Assuming this doesn't conflict with your concurrency settings). On the other hand, if the rate is 5, the queue will execute 5 queued items immediately, wait for 1 second, and then execute 5 more (again, unless you concurrency prevents this).

If one second is the wrong period of time for the rate to apply over, that's also configurable, with the parameter 'rateDenominator'.

```js
const queueConfig = {
    concurrency: 10,
    interval: 200 // Time in ms, defaults to 0
}
const myQueue = new SuperQueue(queueConfig);

```
Or:
```js
const queueConfig = {
    concurrency: 10,
    rate: 5, // Defaults to 0 (No restriction)
    rateDenominator // Time in ms, defaults to 1000
}
const myQueue = new SuperQueue(queueConfig);
```

It is possible to set both a rate and an interval for a single queue, if you want.

### Advanced Queue Item Configuration: Priority ###

You can send options along when you push a function to the queue. Using this, you can set the priority of a function. The highest priority function will be at the front of the queue, and the lowest at the back. When items have the same priority, the oldest one will be at the front. Larger numbers == higher priority.

The default priority is 10.

```js

const SuperQueue = require('superqueue');

const myQueue = SuperQueue();

function lowPriorityFunc(param1) {
    return new Promise((resolve, reject) => {...});
}

function highPriorityFunc(param1) {
    return new Promise((resolve, reject) => {...});
}

const priorityConfig = {
    priority: 11 // Default priority is 10, higher numbers happen sooner
}

myQueue.push(lowPriorityFunc, 'one');
myQueue.push(lowPriorityFunc, 'two');
myQueue.push(priorityConfig, highPriorityFunc, 'three');

/* 
 * Order will be: 'one', 'three', 'two', so long as the first function
 * wasn't resolved when the third one was added.
 */

```

### Advanced Queue Configuration: Flags ###

As explained above, you can configure a SuperQueue with a number of restrictions which apply to every item within the Queue, such as concurrency, interval, and rate. But what if you need to apply restrictions to only a certain subset of the queued items?

For example, you want to use an API which has both public and private calls. The API is rate limited to 5 requests per second, total. Public requests are simple, but the private requests require you to supply a nonce value which is always increasing.

Therefore you need a queue that has an overall rate of 5, and the concurrency is unlimited, but the private calls need to have a concurrency of 1. Also, private calls are more important, so they need a higher priority (i.e. if it's possible to send a private call, don't send a public call instead).

To implement this, simply set up a 'private' flag:

```js

const SuperQueue = require('superqueue');

const queueConfig = {
    concurrency: 0, // Unlimited concurrency
    rate: 5
};
const myQueue = new SuperQueue(queueConfig);

const flagConfig = {
    name: 'private',
    concurrency = 1
};
myQueue.addFlag(flagConfig);

function publicFunc(param1) {
    return new Promise((resolve, reject) => {...});
}

function privateFunc(param1, param2) {
    return new Promise((resolve, reject) => {...});
}

const privateConfig = {
    priority: 11,
    flags: ['private']
}
myQueue.push(privateConfig, privateFunc, param1, param2)
    .then((data) => {
        // Use data
    })
    .catch((err) => {
        // Handle error
    });
    
myQueue.push(publicFunc, param1)
    .then((data) => {
        // Use the data
    })
    .catch((err) => {
        // Handle error
    });
    
```

And that's all there is to it!

Methods
-------
```js
.push(function, [...args]);

.push({
	priority,            // ?Number<10>
	flags,               // ?[String]
	name,                // ?String
}, function, [...args]);

.addFlag({
	name,                // String
	concurrency,         // ?Integer<1>
	interval,            // ?Number
	rate,                // ?Number
	rateDenominator,     // ?Number<1000>
});

.pause();
// Stops executing queued items. Returns false if already paused, true otherwise.

.pause(flag);
// Stops executing queued items with flag. If any flag on an item is paused, the item will never execute. Returns false if already paused, true otherwise.

.unpause();
// Resumes queue execution. Returns false if already unpaused, true otherwise.

.unpause(flag);
// Resumes queue execution for flag. Returns false if already unpaused, true otherwise.

.getLength();
// Returns number of queued (non-executing) items

.getLength(flag);
// Returns number of queued (non-executing) items under flag

.getConcurrent();
// Returns number of items currently executing

.getConcurrent(flag);
// Returns number of items categorized under flag currently executing

.on('start', (queueLength) => {} );
// Whenever a function starts executing

.on('complete', (queueLength, { executionTime, flags, error, result }) => {} );
// Whenever a function completes

.on('empty', () => {} );
// Whenever the queue becomes empty
```