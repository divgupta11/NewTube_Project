const jwt = require("jsonwebtoken");
const User = require("../models/User");

const adminProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Admin account is blocked" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid admin token" });
  }
};

module.exports = { adminProtect };
