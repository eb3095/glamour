//
// Requires
//

const app = require('./package.json');
const config = require('./config/config.json');
const subredditsConfig = require('./config/subreddits.json');
const repliesConfig = require('./config/replies.json');
const typosConfig = require('./config/typos.json');
const snoowrap = require('snoowrap');
const snoostorm = require('snoostorm');
const Task = require('async2sync').Task;
const Reply = require('./libraries/reply.js').Reply;
const Typo = require('./libraries/typo.js').Typo;
const emotionDetection = require('emotional_alert');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');
const reddit = new snoowrap({
    userAgent: config.redditCredentials.userAgent.replace("{version}", `v${app.version}`),
    clientId: config.redditCredentials.appID,
    clientSecret: config.redditCredentials.appSecret,
    username: config.redditCredentials.username,
    password: config.redditCredentials.password
});


//
// Some people like to use console.log where it doesn't belong. Thanks for that.
//

console._log = console.log;
console.log = function () {
};


//
// Global Variables
//

var database;
var replies = [];
var subreddits = [];
var eventBuffer = [];
var typoEngine;


//
// Functions
//

function log(string) {
    let date = new Date();
    let time = (date.getMonth() + 1) + "/" + (date.getDate() + 1) + "/" + date.getFullYear() + ` ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    let msg = `[${time}] ${string}`;
    console._log(msg);
    fs.appendFileSync('bot.log', `${msg}\n`);
}

function shuffle(array) {
    let index = array.length;
    let temp;
    let rIndex;

    while (0 !== index) {
        rIndex = Math.floor(Math.random() * index);
        index--;
        temp = array[index];
        array[index] = array[rIndex];
        array[rIndex] = temp;
    }

    return array;
}

function getSubmission(comment) {
    let link = comment.permalink;
    let split = link.split("/");
    return split[4];
}


function removeFromArray(object, array) {
    let index = array.indexOf(object);
    if (index !== -1) array.splice(index, 1);
}


//
// Flow
//

function initiate() {
    log("Starting up");
    log("Setting up typo system");
    typoEngine = new Typo(typosConfig.typos);
    log("Starting Reply Processor");
    setTimeout(processReplyQueues, 1000);
    log("Connecting to database");
    connectToDatabase();
}

function connectToDatabase() {
    let url = `mongodb://${config.databaseCredentials.user}:${config.databaseCredentials.password}@${config.databaseCredentials.host}/${config.databaseCredentials.database}`;
    MongoClient.connect(url, {useNewUrlParser: true, useUnifiedTopology: true}, function (err, client) {
        if (err) {
            log(`Error Connection to database: ${err.message}`);
        } else {
            log("Connected to database");
            database = client.db();
            setupReplies();
        }
    });
}

function setupReplies() {
    log("Building replies");
    repliesConfig.replies.forEach(rep => {
        let reply;
        try {
            reply = new Reply(rep, typoEngine);
        } catch (err) {
            log(err);
            return;
        }
        replies.push(reply);
    });
    setupSubreddits();
}

function setupSubreddits() {
    log("Setting up Subreddits");
    subredditsConfig.subreddits.forEach(sub => {
        log(`Preparing ${sub.name}`);
        let subreddit = {
            name: sub.name,
            displayName: `/r/${sub.name}`,
            cooldown: sub.cooldown * 60000,
            reddit: reddit.getSubreddit(sub.name),
            replyQueue: [],
            lastReply: 0,
            pollTime: sub.pollTime,
            results: sub.results
        };
        startListener(subreddit);
    });
}

function startListener(subreddit) {
    subreddits.push(subreddit);
    log(`Listening for comments on: ${subreddit.displayName}`);
    let options = {
        subreddit: subreddit.name,
        results: subreddit.results,
        pollTime: subreddit.pollTime * 1000
    };
    subreddit.listener = new snoostorm.CommentStream(reddit, options);
    try {
        subreddit.listener.on("item", comment => {

            // Debug line for data gathering
            if (config.debugMode) {
                log(`Comment Received: ${comment.id} Subreddit: ${subreddit.displayName} Message: ${comment.body}`);
                let rebuild = [];

                comment.body.split(" ").forEach(word => {
                    if (word.length < 3) {
                        return;
                    }
                    if (word.includes("/r/")
                        || word.includes("/u/")
                        || word.includes("://")) {
                        return;
                    }
                    rebuild.push(word);
                });
                let naturalized = rebuild.join(" ");
                let emotional = emotionDetection(naturalized);
                let sent = sentiment.analyze(naturalized);
                log(`- Emotion: ${emotional.bayes.prediction} Emotion Probability: ${emotional.bayes.proba} Vulnerability: ${emotional.emotional} Sentiment: ${sent.comparative}`);
            }
            // End debug lines

            let event = {
                subreddit: subreddit,
                comment: comment
            };
            commentEvent(event);
        });
        subreddit.listener.on("error", function (err) {
            log(`Error encountered listening on ${subreddit.displayName}, Error: ${err.message}`);
        });
    } catch (err) {
        log(`Error encountered listening on ${subreddit.displayName}, Error: ${err.message}`);
    }
}

function commentEvent(event) {
    if (eventBuffer.includes(event.comment.id)) {
        return;
    } else {
        eventBuffer.push(event.comment.id);
    }
    if (event.comment.author.name.toLowerCase() === config.redditCredentials.username) {
        return;
    }
    let date = new Date();
    event.time = date.getTime();
    hasRepliedTo(event);
}

function hasRepliedTo(event) {
    database.collection("Comments").countDocuments({ID: event.comment.id}, {limit: 1}).then(result => {
        if (result > 0) {
            return;
        }
        searchReplies(event);
    }, err => {
        log(`Error entering into database: ${err.message}`);
        removeFromArray(event.comment.id, eventBuffer);
    });
}

function searchReplies(event) {
    shuffle(replies);
    replies.some(reply => {
        if (event.ignoreReplies) {
            if (event.ignoreReplies.includes(reply)) {
                return false;
            }
        }
        if (reply.isTriggered(event)) {
            if (reply.oncePerUser) {
                hasRepliedToUser(event, reply);
                return true;
            }
            if (reply.oncePerSubmission) {
                hasRepliedToSubmission(event, reply);
                return true;
            }
            log("Pushing to QUEUE!");
            insertComment(reply, event);
            return true;
        }
    });
    removeFromArray(event.comment.id, eventBuffer);
}

function hasRepliedToUser(event, reply) {
    database.collection("Users").countDocuments({
        ID: event.comment.author.name,
        Reply: reply.name
    }, {limit: 1}).then(result => {
        if (result > 0) {
            if (!event.ignoreReplies) {
                event.ignoreReplies = [
                    reply
                ];
            } else {
                event.ignoreReplies.push(reply);
            }
            searchReplies(event);
            return;
        }
        if (reply.oncePerSubmission) {
            hasRepliedToSubmission(event, reply);
        } else {
            insertComment(reply, event);
        }
    }, err => {
        log(`Error entering into database: ${err.message}`);
        removeFromArray(event.comment.id, eventBuffer);
    });
}

function hasRepliedToSubmission(event, reply) {
    let sub = getSubmission(event.comment);
    database.collection("Submissions").countDocuments({
        ID: sub,
        Reply: reply.name
    }, {limit: 1}).then(result => {
        if (result > 0) {
            if (!event.ignoreReplies) {
                event.ignoreReplies = [
                    reply
                ];
            } else {
                event.ignoreReplies.push(reply);
            }
            searchReplies(event);
            return;
        }
        insertComment(reply, event);
    }, err => {
        log(`Error entering into database: ${err.message}`);
        removeFromArray(event.comment.id, eventBuffer);
    });
}

function insertComment(reply, event) {
    database.collection("Comments").insertOne({ID: event.comment.id}).then(res => {
        insertUser(reply, event);
    }, err => {
        log(`Error entering into database: ${err.message}`);
        removeFromArray(event.comment.id, eventBuffer);
    });
}

function insertUser(reply, event) {
    database.collection("Users").insertOne({ID: event.comment.id, Reply: reply.name}).then(res => {
        insertSubmission(reply, event);
    }, err => {
        log(`Error entering into database: ${err.message}`);
        removeFromArray(event.comment.id, eventBuffer);
    });
}

function insertSubmission(reply, event) {
    database.collection("Submissions").insertOne({ID: event.comment.id, Reply: reply.name}).then(res => {
        addToReplyQueue(reply, event);
    }, err => {
        log(`Error entering into database: ${err.message}`);
        removeFromArray(event.comment.id, eventBuffer);
    });
}

function addToReplyQueue(reply, event) {
    let rep = {
        reply: reply,
        event: event
    };
    if (reply.replyDelay) {
        let delay = reply.replyDelay;
        if (reply.delayFuzz) {
            delay += Math.floor(Math.random() * reply.delayFuzz);
        }
        rep.delay = delay;
    }
    event.subreddit.replyQueue.push(rep);
    removeFromArray(event.comment.id, eventBuffer);
}

function processReplyQueues() {
    let waitTask = new Task();
    waitTask.callback = processReplyQueues;
    subreddits.forEach(subreddit => {
        let task = {
            subreddit: subreddit,
            waitTask: waitTask
        };

        processReplyQueue(task);
        waitTask.tasks++;
    });
    waitTask.waitFor();
}

function processReplyQueue(task) {
    let date = new Date();
    if (task.subreddit.lastReply + task.subreddit.cooldown > date.getTime()) {
        task.waitTask.tick();
        return;
    }
    let replied = false;
    task.subreddit.replyQueue.some(reply => {
        let ready = reply.event.time + reply.delay;
        if (date.getTime() >= ready) {
            doReply(reply, task);
            replied = true;
            return true;
        }
    });
    if (!replied) {
        task.waitTask.tick();
    }
}

function doReply(reply, task) {
    let date = new Date();
    let message = reply.reply.generateMessage();
    if (config.debugMode) {
        log("----------------------------------------------");
        log(`Would of replied to Comment: ${reply.event.comment.id}`);
        log(`Subreddit: ${reply.event.subreddit.displayName}`);
        log(`Author: ${reply.event.comment.author.name}`);
        log(`Message: ${reply.event.comment.body}`);
        log(`Reply: ${message}`);
        log("----------------------------------------------");
        removeFromArray(reply, reply.event.subreddit.replyQueue);
        reply.event.subreddit.lastReply = date.getTime();
        task.waitTask.tick();
    } else {
        reply.event.comment.reply(message).then(result => {
            log("----------------------------------------------");
            log(`Replied to Comment: ${reply.event.comment.id}`);
            log(`Author: ${reply.event.comment.author.name}`);
            log(`Message: ${reply.event.comment.body}`);
            log(`Reply: ${message}`);
            log("----------------------------------------------");
            removeFromArray(reply, reply.event.subreddit.replyQueue);
            reply.event.subreddit.lastReply = date.getTime();
            task.waitTask.tick();
            if (reply.reply.cooldown > 0) {
                reply.reply.putOnCooldown();
            }
        }, err => {
            log(`Failed to reply to Comment: ${reply.event.comment.id} Error: ${err.message}`);
            task.waitTask.tick();
        });
    }
}


//
// Entry Point
//

process.stdout.write('\033c');
console._log("Glamour - An Advanced Reddit Bot");
console._log(`Version: ${app.version}`);
console._log(`Description: ${app.description}`);
console._log(`Author: ${app.author}`);
console._log("------------------------------------\n");

initiate();