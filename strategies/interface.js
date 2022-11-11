const DeploymentError = require("./error")

/**
 * Deployment strategy interface.
 * Required methods in subclasses: init, startKernel, shutdownKernel.
 * @interface
 */
module.exports = class Deployment {
  /**
   * Creates an instance.
   * @param  {Object}     obj Configuration object
   * @param  {Object}     job Job object
   * @return {Deployment}     Intance
   */
  static init(...args) {
    return new this(...args)
  }
  /**
   * @param {Object} obj
   */
  constructor(obj, job) {
    /**
     * Kue job object
     * @type {Object}
     */
    this.job = job;
    /**
     * User object
     * @type {Object}
     */
    this.user = obj.user;
    /**
     * Project id
     * @type {String}
     */
    this.project = obj.project;
    /**
     * Deployment status
     * @type {String}
     */
    this.status = obj.status || null;
    /**
     * Title to recognize from the GUI
     * @type {String}
     */
    this.title = this.user.email + "|" + this.project;
    /**
     * Jupyter's IP or hostname.
     * @type {String}
     */
    this.host = null;
    /**
     * Jupyter port number
     * @type {Number}
     */
    this.ports = [8888, 8889];
  }
  /**
   * Serializes deployment data into a plain javascript object.
   * @return {Object}
   */
  export() {
    let result = {};
    ;["user", "project", "status", "title", "host", "ports", "strategy"]
      .forEach(prop => result[prop] = this[prop]);
    return result;
  }
  /**
   * Updates job data
   * @return {Promise}
   */
  async update() {
    let obj = this.export();
    this.job.data = Object.assign(this.job.data, obj);
    return new Promise((res, rej) => {
      this.job.save(err => {
        if (err) return rej(err);
        return res(this.job.data);
      })
    })
  }
  /**
   * @required
   */
  async start() {}
  /**
   * @required
   */
  async shutdown() {}
  /**
   * @optional
   * @param  {String}  name Package name
   */
  async installPackage(name) {
    return new DeploymentError("Deployment strategy doesn't support package management")
  }
  /**
   * @optional
   * @param  {String} name Package name
   */
  async removePackage(name) {
    return new DeploymentError("Deployment strategy doesn't support package management")
  }
}
