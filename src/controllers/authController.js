import db from "../config/db.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import axios from "axios";

export const googleLogin = async (req ,res) => {
  const { token } = req.body;
  
  try {
    // Verify Google ID token
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
    );

    const { email, name, picture, sub: google_id } = response.data;

    // Check if user exists
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    let user = rows[0];

    if (!user) {
      // Create new user
      const [result] = await db.query(
        "INSERT INTO users (name, email, picture, google_id) VALUES (?, ?, ?, ?)",
        [name, email, picture, google_id]
      );
      user = { id: result.insertId, name, email, picture };
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await db.query("INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)", [user.id, refreshToken]);

    res.json({ user, accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ message: "Google login failed", error: err.message });
  }
};

export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.sendStatus(401);

  try {
    const [rows] = await db.query("SELECT * FROM refresh_tokens WHERE token = ?", [token]);
    const storedToken = rows[0];
    if (!storedToken) return res.sendStatus(403);

    const jwtPayload = require("jsonwebtoken").verify(token, process.env.JWT_REFRESH_SECRET);

    const [userRows] = await db.query("SELECT * FROM users WHERE id = ?", [jwtPayload.id]);
    const user = userRows[0];

    const accessToken = generateAccessToken(user);

    res.json({ accessToken });
  } catch (err) {
    res.sendStatus(403);
  }
};
