const FaceToFaceProcessor = require('../workers/processors/faceToFaceProcessor');
const TapsProcessor = require('../workers/processors/tapsProcessor');
const RedClawProcessor = require('../workers/processors/redClawProcessor');

class ProcessorRegistry {
  constructor() {
    this.processors = [];
    this.initializeProcessors();
  }

  initializeProcessors() {
    this.processors.push(new FaceToFaceProcessor());
    this.processors.push(new TapsProcessor());
    this.processors.push(new RedClawProcessor());
  }

  getProcessors() {
    return this.processors;
  }

  getProcessorCount() {
    return this.processors.length;
  }

}

module.exports = ProcessorRegistry;