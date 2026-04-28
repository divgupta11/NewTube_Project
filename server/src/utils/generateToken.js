const jwt = require("jsonwebtoken");
const getJwtSecret = require("./jwtSecret");

const generateToken = (userId) =>
  jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });

module.exports = generateToken;
