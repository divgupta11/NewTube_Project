const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const subscribersCount = (subscribers) => {
  if (Array.isArray(subscribers)) return subscribers.length;
  return Number(subscribers || 0);
};

const signup = async (req, res) => {
  try {
    const { username, name, email, password } = req.body;
    const finalUsername = username || name;

    if (!finalUsername || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username: finalUsername, email, password: hashedPassword });
    const token = generateToken(user._id);

    return res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        subscribersCount: subscribersCount(user.subscribers)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account is blocked by admin" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);
    return res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        name: user.username,
        email: user.email,
        avatar: user.avatar,
        subscribersCount: subscribersCount(user.subscribers),
        isAdmin: Boolean(user.isAdmin)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const getMe = async (req, res) => {
  return res.json(req.user);
};

module.exports = { signup, login, getMe };
