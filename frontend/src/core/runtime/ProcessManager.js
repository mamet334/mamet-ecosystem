export class ProcessManager {
  constructor(bus) {
    this.bus = bus;
    this.tasks = new Map();
    this.processes = new Map();
    this.defaultTimeoutMs = 15000;
    this.nextPID = 1;
    
    this.bus.on('Process:Execute', (payload) => {
      const data = payload?.data || payload;
      this.execute(data.taskName, data.fn, ...(data.args || []));
    });
  }

  generatePID() {
    const pid = this.nextPID++;
    return pid;
  }

  async start(taskName, fn, ...args) {
    const pid = this.generatePID();
    const processInfo = {
      pid,
      taskName,
      status: 'running',
      startTime: Date.now(),
      fn,
      args
    };
    
    this.processes.set(pid, processInfo);
    this.bus.emit('Process:Start', { pid, taskName, timestamp: Date.now() });
    
    try {
      const result = await this._executeWithTimeout(taskName, fn, ...args);
      processInfo.status = 'completed';
      processInfo.endTime = Date.now();
      processInfo.result = result;
      this.bus.emit('Process:Complete', { pid, taskName, result, timestamp: Date.now() });
      return { pid, result };
    } catch (error) {
      processInfo.status = 'error';
      processInfo.endTime = Date.now();
      processInfo.error = error.message;
      this.bus.emit('Process:Error', { pid, taskName, error: error.message || error, timestamp: Date.now() });
      throw error;
    }
  }

  async stop(pid) {
    const process = this.processes.get(pid);
    if (!process) {
      throw new Error(`Process with PID ${pid} not found`);
    }
    
    process.status = 'stopped';
    process.endTime = Date.now();
    this.bus.emit('Process:Stopped', { pid, taskName: process.taskName, timestamp: Date.now() });
    return true;
  }

  async restart(pid) {
    const process = this.processes.get(pid);
    if (!process) {
      throw new Error(`Process with PID ${pid} not found`);
    }
    
    await this.stop(pid);
    return await this.start(process.taskName, process.fn, ...process.args);
  }

  getProcess(pid) {
    return this.processes.get(pid) || null;
  }

  listProcesses() {
    return Array.from(this.processes.values()).map(p => ({
      pid: p.pid,
      taskName: p.taskName,
      status: p.status,
      startTime: p.startTime,
      endTime: p.endTime,
      duration: p.endTime ? p.endTime - p.startTime : Date.now() - p.startTime
    }));
  }

  async killAll() {
    const pids = Array.from(this.processes.keys());
    for (const pid of pids) {
      await this.stop(pid);
    }
    this.processes.clear();
    this.bus.emit('Process:KillAll', { timestamp: Date.now() });
    return true;
  }

  async execute(taskName, fn, ...args) {
    return await this.start(taskName, fn, ...args);
  }

  async _executeWithTimeout(taskName, fn, ...args) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Process timeout: Task '${taskName}' melebihi batas waktu ${this.defaultTimeoutMs}ms`));
      }, this.defaultTimeoutMs);
    });

    const executionPromise = (async () => {
      return await fn(...args);
    })();

    return await Promise.race([executionPromise, timeoutPromise]);
  }
}