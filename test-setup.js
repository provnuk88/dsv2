const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

module.exports = {
  mochaHooks: {
    async beforeAll() {
      mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
    },
    async afterAll() {
      await mongoose.disconnect();
      if (mongoServer) {
        await mongoServer.stop();
      }
    }
  }
};
