const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId);

    if (!admin || !admin.isActive) {
      return res
        .status(401)
        .json({ error: "Invalid token or admin account disabled." });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired." });
    }

    res.status(401).json({ error: "Invalid token." });
  }
};

const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== "super_admin") {
    return res
      .status(403)
      .json({ error: "Access denied. Super admin role required." });
  }
  next();
};

module.exports = { auth, superAdminOnly };
