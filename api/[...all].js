const connectDB = require("../server/src/config/db");
const app = require("../server/src/app");

let dbConnectionPromise = null;

module.exports = async (req, res) => {
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDB().catch((error) => {
      dbConnectionPromise = null;
      throw error;
    });
  }

  await dbConnectionPromise;
  return app(req, res);
};
