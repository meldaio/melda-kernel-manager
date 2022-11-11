const Deployment      = require("./interface.js")
const Jupyter         = require("@jupyterlab/services")
const DeploymentError = require("./error")
const Docker          = require("dockerode")


const { JUPYTER_TOKEN, JUPYTER_IMAGE } = process.env

const DOCKER_CONFIG = { socketPath: '/var/run/docker.sock' }
const CONTAINER_PORTS = [ 8888, 8889 ];
const docker = new Docker(DOCKER_CONFIG)

module.exports = class LocalInstallment extends Deployment {

  constructor(...args) {
    super(...args);
    this.host = "127.0.0.1"
    this.strategy = "LocalInstallment"
  }

  async start() {
    await this.setStatus("DEPLOYING");
    this.job.progress(0, 100, { message: "Starting Jupyter" });
    await this.configureContainer();
    this.job.progress(70, 100, { message: "Starting Jupyter" });
    this.ports = await this.getPorts();
    this.job.progress(100, 100, { message: "Jupyter started" });
    return this.export();
  }

  async shutdown() {
    await this.setStatus("SHUTTINGDOWN")
    let container = await this.getContainer();
    if (container) {
      await container.kill();
      await container.remove();
    }
    await this.setStatus("SHUTDOWN")
  }

  async getSettings() {
    const ports = await this.getPorts();
    const serverSettings = Jupyter.ServerConnection.makeSettings({
      baseUrl: "http://"+ this.host +":"+ ports[0] +"/",
      wsUrl: "ws://"+ this.host +":"+ ports[0] +"/",
    });

    return serverSettings;
  }

  async configureContainer() {
    const container = await this.getContainer();
    let createContainer = true;

    if (container) {
      const status = await container.inspect();
      const isRunning = status.State.Running;
      const isPaused = status.State.Paused;
      const isRestarting = status.State.Restarting;

      if (isRunning || isRestarting) {
        return container;
      }

      if (isPaused) {
        return await container.start();
      }

      return await container.start();
    }

    return await this.createContainer();
  }

  async createContainer() {
    const ports = await findAvailablePorts(CONTAINER_PORTS.length);

    const container = await docker.createContainer({
      name: await this.getContainerName(),
      Image: JUPYTER_IMAGE,
      ExposedPorts: getExposedPorts(CONTAINER_PORTS),
      HostConfig: { PortBindings: getPortBindings(CONTAINER_PORTS, ports) }
    });

    await container.start();
    await this.starting();

    return container;
  }

  async getContainer() {
    const filters = { name: [await this.getContainerName()] };
    const containers = await docker.listContainers({ all: true, filters })

    if (containers.length === 0) {
      return null;
    }

    return await docker.getContainer(containers[0].Id);
  }

  async getPorts() {
    let container = await this.getContainer();
    if ( ! container ) {
      return null
    }
    let data = await container.inspect()
    let ports = Object
      .values(data.HostConfig.PortBindings)
      .flat()
      .map(item => Number(item.HostPort));
    return ports;
  }

  async getContainerName() {
    return "melda-jupyter-container-" + this.user.subscription + '-' + this.user.uri + '-' + this.project;
  }

  async setStatus(status) {
    this.status = status || this.status;
    await this.update();
  }

  async starting(startTime) {
    if ( ! startTime )
      startTime = Date.now();

    if (startTime + 5 * 1000 < Date.now())
      throw new Error("Couldn't connect to Jupyter");

    try {
      await Jupyter.KernelAPI.listRunning(await this.getSettings());
      return true;
    } catch (err) {
      return await this.starting(startTime);
    }
  }
}


function getExposedPorts() {
  return CONTAINER_PORTS.reduce((result, current) => {
    result[current + "/tcp" ] = {}
    return result
  }, {});
}

function getPortBindings(ports, hostPorts) {
  var i = 0
  hostPorts = hostPorts || ports;
  return ports.reduce((result, current) => {
    result[current + "/tcp" ] = [{ "HostPort": String(hostPorts[i++]) }]
    return result
  }, {})
}

async function findAvailablePorts(numberOfPorts = 1) {
  const status = ["paused", "created", "restarting", "removing", "running"];
  const result = await docker.listContainers({ status });
  const portsInUse = result
    .map(container => container.Ports)
    .flat()
    .map(obj => obj.PublicPort);

  const start = CONTAINER_PORTS[0];
  const found = [];

  for (let i = 0;; i++) {
    if ( ! portsInUse.includes(i + start) ) {
      found.push(i + start)
    }

    if (found.length === numberOfPorts) {
      break;
    }
  }

  return found;
}