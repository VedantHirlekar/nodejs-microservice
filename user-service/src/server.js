const express = require("express");
const pool = require("./db");

require("dotenv").config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3001;


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {

    res.status(200).json({
        service: "user-service",
        status: "UP"
    });

});


// ==========================================
// GET ALL USERS
// ==========================================

app.get("/users", async (req, res) => {

    try {

        const [users] = await pool.query(
            "SELECT * FROM users"
        );

        res.status(200).json(users);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database error"
        });

    }

});


// ==========================================
// GET USER BY ID
// ==========================================

app.get("/users/:id", async (req, res) => {

    try {

        const [users] = await pool.query(
            "SELECT * FROM users WHERE id = ?",
            [req.params.id]
        );

        if (users.length === 0) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        res.status(200).json(users[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database error"
        });

    }

});


// ==========================================
// CREATE USER
// ==========================================

app.post("/users", async (req, res) => {

    try {

        const { name, email } = req.body;

        if (!name || !email) {

            return res.status(400).json({
                message: "Name and email are required"
            });

        }

        const [result] = await pool.query(
            "INSERT INTO users (name, email) VALUES (?, ?)",
            [name, email]
        );

        res.status(201).json({

            id: result.insertId,

            name: name,

            email: email

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Unable to create user"
        });

    }

});


// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log(
        `User service running on port ${PORT}`
    );

});