const express = require("express");

const pool = require("./db");

require("dotenv").config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3005;


// ==========================================
// HEALTH
// ==========================================

app.get("/health", (req, res) => {

    res.json({

        service: "notification-service",

        status: "UP"

    });

});


// ==========================================
// GET NOTIFICATIONS
// ==========================================

app.get("/notifications", async (req, res) => {

    try {

        const [notifications] = await pool.query(

            "SELECT * FROM notifications"

        );

        res.json(notifications);

    } catch (error) {

        console.error(error);

        res.status(500).json({

            message: "Database error"

        });

    }

});


// ==========================================
// CREATE NOTIFICATION
// ==========================================

app.post("/notifications", async (req, res) => {

    try {

        const {
            userId,
            message
        } = req.body;


        if (!userId || !message) {

            return res.status(400).json({

                message: "userId and message are required"

            });

        }


        const [result] = await pool.query(

            `INSERT INTO notifications
            (user_id, message, status)
            VALUES (?, ?, ?)`,

            [
                userId,
                message,
                "SENT"
            ]

        );


        res.status(201).json({

            notificationId: result.insertId,

            userId,

            message,

            status: "SENT"

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            message: "Unable to send notification"

        });

    }

});


app.listen(PORT, () => {

    console.log(

        `Notification service running on port ${PORT}`

    );

});