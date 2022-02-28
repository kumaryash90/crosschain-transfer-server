const express = require("express");
const bodyParser = require("body-parser");
const  cors = require("cors");
//import dotenv from "dotenv";
const { ethers } = require("ethers");
const { transferOutsideFrom } =  require("./controllers/bridge.js");

const app = express();
require('dotenv').config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.get('/', (req, res) => {
    res.send("multichain-token-project API");
});

app.post('/transfer', transferOutsideFrom);

const PORT = process.env.PORT || 5500;

app.listen(PORT, () => console.log("server running on port ", PORT));