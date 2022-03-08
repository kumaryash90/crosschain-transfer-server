const { ethers } = require("ethers");
const artifact = require("../artifacts/rinkeby/MultiChainTestToken.json");
const ADMIN_ADDRESS = "0xFD78F7E2dF2B8c3D5bff0413c96f3237500898B3";
require('dotenv').config();

const txnFlags = {
    IDLE: 0,
    WORKING: 1,
    SUCCESS: 2,
    FAILED: -1,
    INVALID_REQUEST: -2
}

let txnStatus = txnFlags.IDLE;
let errorMsg;

const PROVIDERS = {
    4: process.env.ALCHEMY_RINKEBY,
    3: process.env.ALCHEMY_ROPSTEN
}

const TOKEN_ADDRESS = {
    4: "0x9e8dBC0d301825F190C2519C04eaf684739Bd070",
    3: "0x43Cf390bca8cCc836F737E0bf415936877ef9CFA",
    5: "",
    42: "",
}

const getAddress = (chainId) => {
    return TOKEN_ADDRESS[chainId];
}

const transfer = async (req, res) => {
    txnStatus = txnFlags.WORKING;
    res.status(200).send(`${txnStatus}`);
    const data = req.body;
    transferOutsideFrom(data);
}

const sendStatus = async (req, res) => {
    if(txnStatus === txnFlags.FAILED) {
        res.status(409).send(`${errorMsg}`);
    } else {
        res.status(200).send(`${txnStatus}`);
    }
}

const sendError = async (req, res) => {
    res.status(409).send({ error: errorMsg });
}

const transferOutsideFrom = async (data) => {
    // res.set('Access-Control-Allow-Origin', '*');
    try {
        console.log("received formdata: ", data);
        const chainId = data.chainId;
        const provider = new ethers.providers.JsonRpcProvider(`${PROVIDERS[chainId]}`);
        const signer = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
        const address = getAddress(chainId);

        if(!address) {
            txnStatus = txnFlags.INVALID_REQUEST;
            return;
        }

        const mctt = new ethers.Contract(address, artifact.abi, signer);

        if(chainId === data.to_net) {
            console.log("here");
            let tx = await mctt.transferFrom(data.account, data.to, ethers.utils.parseEther(`${data.amount}`));
            const receipt = await tx.wait();
            txnStatus = txnFlags.SUCCESS;
            //res.status(201).json({ hash: tx.hash });
        } else {
            let tx = await mctt.transferOutsideFrom(data.account, data.to, ethers.utils.parseEther(`${data.amount}`));
            const receipt = await tx.wait();
            console.log("hash: ", tx.hash);
            const topic = mctt.interface.getEventTopic('TransferOutside');
            console.log("here 1");
            const logs = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
            console.log("here 2");
            const event = mctt.interface.parseLog(logs);
            console.log("here 3");

            if(logs) {
                const hash = await receiveOutside(data.to_net, event.args[0], event.args[1], ethers.utils.formatEther(event.args[2]));
                //return res.status(201).json({ hash: tx.hash});
                if(hash) txnStatus = txnFlags.SUCCESS;
            } 
        }
    } catch (error) {
        let errObject = Object.assign({}, error)
        // if(errObject.error) {
        //     console.log("we're here");
        //     //console.log(errObject.error);
        //     res.status(409).json({ message: errObject.error.error.error });
        // } else {
        //     console.log("no we're here");
        //     // console.log(error);
        //     res.status(409).json({ message: error.code });
        // }
        console.log("errobject: ", errObject.error);
        const errorBody = JSON.parse(errObject.error.error.body);
        console.log("errBody msg: ", errorBody.error.message);
        // res.statusMessage = errorBody.error.message;
        // res.status(409).send(`${errorBody.error.message}`);
        txnStatus = txnFlags.FAILED;
        errorMsg = errorBody.error.message;
    }
}

const receiveOutside = async (to_net, from, to, amount) => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(`${PROVIDERS[to_net]}`);
        const signer = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
        const address = getAddress(to_net);
        const mctt = new ethers.Contract(address, artifact.abi, signer);
        const tx = await mctt.receiveOutside(from, to, ethers.utils.parseEther(`${amount}`));
        const receipt = await tx.wait();
        console.log("receipt outside: ", receipt.events);
        return tx.hash;
    } catch(error) {
        let errObject = Object.assign({}, error);
        console.log("errobject: ", errObject.error);
        const errorBody = JSON.parse(errObject.error.error.body);
        console.log("errBody msg: ", errorBody.error.message);
        // res.statusMessage = errorBody.error.message;
        // res.status(409).send(`${errorBody.error.message}`);
        txnStatus = txnFlags.FAILED;
        errorMsg = errorBody.error.message;
    }
}

module.exports = { transfer, sendStatus, sendError };