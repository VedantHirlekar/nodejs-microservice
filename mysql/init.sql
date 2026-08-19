CREATE DATABASE IF NOT EXISTS user_db;

CREATE DATABASE IF NOT EXISTS product_db;

CREATE DATABASE IF NOT EXISTS order_db;

CREATE DATABASE IF NOT EXISTS payment_db;

CREATE DATABASE IF NOT EXISTS notification_db;


USE user_db;

CREATE TABLE IF NOT EXISTS users (

    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(150) NOT NULL UNIQUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


INSERT INTO users (name, email)
VALUES
('Vedant', 'vedant@example.com'),
('Rahul', 'rahul@example.com');


USE product_db;

CREATE TABLE IF NOT EXISTS products (

    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    price DECIMAL(10,2) NOT NULL,

    stock INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


INSERT INTO products (name, price, stock)
VALUES
('Laptop', 75000, 10),
('Mouse', 1500, 50),
('Keyboard', 3000, 30);


USE order_db;

CREATE TABLE IF NOT EXISTS orders (

    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    product_id INT NOT NULL,

    quantity INT NOT NULL,

    total_price DECIMAL(10,2) NOT NULL,

    status VARCHAR(50) DEFAULT 'CREATED',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


USE payment_db;

CREATE TABLE IF NOT EXISTS payments (

    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,

    amount DECIMAL(10,2) NOT NULL,

    status VARCHAR(50) DEFAULT 'PENDING',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


USE notification_db;

CREATE TABLE IF NOT EXISTS notifications (

    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    message TEXT NOT NULL,

    status VARCHAR(50) DEFAULT 'SENT',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);