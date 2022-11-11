require("dotenv").config()

const fs = require("fs")
const kue = require("kue")


const strategies = require("./strategies")

const queue = kue.createQueue({
  disableSearch: false,
  redis: {
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST
  }
})

class QueueError extends Error {}

queue.setMaxListeners(Infinity)

queue.process("create jupyter", 100, async (job, done) => {
  let options = job.data
  let strategyName = options.strategy
  let result

  if ( ! strategies[strategyName] ) {
    return done(new QueueError(`Strategy "${strategyName}" doesn't exist`))
  }

  try {
    let strategy = strategies[strategyName].init(options, job)
    result = await strategy.start()
    strategies[strategyName].getAllTasks().then(tasks => {
      queue.create('tasks list', {tasks}).save()
    }).catch(err => console.error(err))
  } catch (err) {
    console.error(err);
    return done(err)
  }

  done(null, result)
})

queue.process("shutdown jupyter", 100, async (job, done) => {
  let options = job.data
  let strategyName = options.strategy

  if ( ! strategies[strategyName] ) {
    return done(new QueueError(`Strategy "${strategyName}" doesn't exist`))
  }

  try {
    let strategy = strategies[strategyName].init(options, job)
    strategy.shutdown()
  } catch (err) {
    console.error(err);
    return done(err)
  }

  done(null)
})

queue.process("flush orphan kernels", 1, async (job, done) => {
  let options = job.data
  let strategyName = options.strategy

  if ( ! strategies[strategyName] ) {
    return done(new QueueError(`Strategy "${strategyName}" doesn't exist`))
  }

  try {
    let tasks = await strategies[strategyName].flushOrphans(options.inUse)
    strategies[strategyName].getAllTasks().then(tasks => {
      queue.create('tasks list', {tasks}).save()
    }).catch(err => console.error(err))
    done(null, tasks)
  } catch (err) {
    console.error(err)
  }
})