const FaceToFaceProcessor = require('../workers/processors/faceToFaceProcessor');
const TapsProcessor = require('../workers/processors/tapsProcessor');
const RedClawProcessor = require('../workers/processors/redClawProcessor');
const PrismaProcessor = require('../workers/processors/prismaProcessor');
const TimeVaultProcessor = require('../workers/processors/timeVaultProcessor');

class ProcessorRegistry {
  constructor() {
    this.processors = [];
    this.initializeProcessors();
  }

  initializeProcessors() {
    // Enable all processors
    this.processors.push(new FaceToFaceProcessor());
    this.processors.push(new TapsProcessor());
    this.processors.push(new RedClawProcessor());
    this.processors.push(new PrismaProcessor());
    this.processors.push(new TimeVaultProcessor());
  }

  getProcessors() {
    return this.processors;
  }

  getProcessorCount() {
    return this.processors.length;
  }

}

module.exports = ProcessorRegistry;