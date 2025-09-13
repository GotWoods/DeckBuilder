const FaceToFaceProcessor = require('../workers/faceToFaceProcessor');
const TapsProcessor = require('../workers/tapsProcessor');

class ProcessorRegistry {
  constructor() {
    this.processors = [];
    this.initializeProcessors();
  }

  initializeProcessors() {
    this.processors.push(new FaceToFaceProcessor());
    this.processors.push(new TapsProcessor());
  }

  getProcessors() {
    return this.processors;
  }

  getProcessorCount() {
    return this.processors.length;
  }

}

module.exports = ProcessorRegistry;