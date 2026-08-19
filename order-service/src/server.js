const express = require("express");
const axios = require("axios");

const pool = require("./db");

require("dotenv").config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3003;


// ==========================================
// HEALTH
// ==========================================

app.get("/health", (req, res) => {

    res.json({
        service: "order-service",
        status: "UP"
    });

});


// ==========================================
// GET ORDERS
// ==========================================

app.get("/orders", async (req, res) => {

    try {

        const [orders] = await pool.query(
            "SELECT * FROM orders"
        );

        res.json(orders);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database error"
        });

    }

});


// ==========================================
// CREATE ORDER
// ==========================================

app.post("/orders", async (req, res) => {

    try {

        const {
            userId,
            productId,
            quantity
        } = req.body;


        if (!userId || !productId || !quantity) {

            return res.status(400).json({
                message: "userId, productId and quantity are required"
            });

        }


        // ==========================================
        // CALL USER SERVICE
        // ==========================================

        const userResponse = await axios.get(

            `${process.env.USER_SERVICE_URL}/users/${userId}`

        );


        // ==========================================
        // CALL PRODUCT SERVICE
        // ==========================================

        const productResponse = await axios.get(

            `${process.env.PRODUCT_SERVICE_URL}/products/${productId}`

        );


        const user = userResponse.data;

        const product = productResponse.data;


        // ==========================================
        // CHECK STOCK
        // ==========================================

        if (product.stock < quantity) {

            return res.status(400).json({

                message: "Insufficient stock"

            });

        }


        // ==========================================
        // CALCULATE TOTAL
        // ==========================================

        const totalPrice = product.price * quantity;


        // ==========================================
        // SAVE ORDER
        // ==========================================

        const [result] = await pool.query(

            `INSERT INTO orders
            (user_id, product_id, quantity, total_price, status)
            VALUES (?, ?, ?, ?, ?)`,

            [
                user.id,
                product.id,
                quantity,
                totalPrice,
                "CREATED"
            ]

        );


        res.status(201).json({

            orderId: result.insertId,

            user: user,

            product: product,

            quantity: quantity,

            totalPrice: totalPrice,

            status: "CREATED"

        });


    } catch (error) {

        console.error(error.message);

        res.status(500).json({

            message: "Unable to create order"

        });

    }

});


app.listen(PORT, () => {

    console.log(
        `Order service running on port ${PORT}`
    );

});