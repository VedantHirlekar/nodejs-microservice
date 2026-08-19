const express = require("express");
const pool = require("./db");

require("dotenv").config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3002;


// Health

app.get("/health", (req, res) => {

    res.json({
        service: "product-service",
        status: "UP"
    });

});


// Get all products

app.get("/products", async (req, res) => {

    try {

        const [products] = await pool.query(
            "SELECT * FROM products"
        );

        res.json(products);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database error"
        });

    }

});


// Get product

app.get("/products/:id", async (req, res) => {

    try {

        const [products] = await pool.query(
            "SELECT * FROM products WHERE id = ?",
            [req.params.id]
        );

        if (products.length === 0) {

            return res.status(404).json({
                message: "Product not found"
            });

        }

        res.json(products[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database error"
        });

    }

});


// Create product

app.post("/products", async (req, res) => {

    try {

        const { name, price, stock } = req.body;

        if (!name || price === undefined || stock === undefined) {

            return res.status(400).json({
                message: "Name, price and stock are required"
            });

        }

        const [result] = await pool.query(

            `INSERT INTO products
            (name, price, stock)
            VALUES (?, ?, ?)`,

            [name, price, stock]

        );

        res.status(201).json({

            id: result.insertId,

            name,

            price,

            stock

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Unable to create product"
        });

    }

});


app.listen(PORT, () => {

    console.log(
        `Product service running on port ${PORT}`
    );

});