const express = require("express");

const pool = require("./db");

require("dotenv").config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3004;


// Health

app.get("/health", (req, res) => {

    res.json({

        service: "payment-service",

        status: "UP"

    });

});


// Get payments

app.get("/payments", async (req, res) => {

    try {

        const [payments] = await pool.query(
            "SELECT * FROM payments"
        );

        res.json(payments);

    } catch (error) {

        console.error(error);

        res.status(500).json({

            message: "Database error"

        });

    }

});


// Create payment

app.post("/payments", async (req, res) => {

    try {

        const {
            orderId,
            amount
        } = req.body;


        if (!orderId || !amount) {

            return res.status(400).json({

                message: "orderId and amount are required"

            });

        }


        const [result] = await pool.query(

            `INSERT INTO payments
            (order_id, amount, status)
            VALUES (?, ?, ?)`,

            [
                orderId,
                amount,
                "SUCCESS"
            ]

        );


        res.status(201).json({

            paymentId: result.insertId,

            orderId,

            amount,

            status: "SUCCESS"

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            message: "Payment failed"

        });

    }

});


app.listen(PORT, () => {

    console.log(

        `Payment service running on port ${PORT}`

    );

});