const { ethers } = require("ethers");
const artifact = require("../artifacts/rinkeby/MultiChainTestToken.json");
require('dotenv').config();

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

const transferOutsideFrom = async (req, res) => {
    try {
        const data = req.body;
        console.log("received formdata: ", data);
        const chainId = data.chainId;
        const provider = new ethers.providers.JsonRpcProvider(`${PROVIDERS[chainId]}`);
        const signer = new ethers.Wallet(process.env.ADMIN, provider);
        const address = getAddress(chainId);

        if(!address) return res.status(400).json({ message: "Invalid chainId." });

        const mctt = new ethers.Contract(address, artifact.abi, signer);

        if(chainId === data.to_net) {
            console.log("here");
            let tx = await mctt.transferFrom(data.account, data.to, ethers.utils.parseEther(`${data.amount}`));
            const receipt = await tx.wait();
            res.status(201).json({ hash: tx.hash });
        } else {
            let tx = await mctt.transferOutsideFrom(data.account, data.to, ethers.utils.parseEther(`${data.amount}`));
            const receipt = await tx.wait();
            console.log("hash: ", tx.hash);
            const topic = mctt.interface.getEventTopic('TransferOutside');
            const logs = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
            const event = mctt.interface.parseLog(logs);

            if(logs) {
                const hash = await receiveOutside(data.to_net, event.args[0], event.args[1], ethers.utils.formatEther(event.args[2]));
                return res.status(201).json({ hash: hash});
            } 
        }
    } catch (error) {
        let errObject = Object.assign({}, error)
        if(errObject.error) {
            console.log("errobject: ", errObject.error);
            const errorBody = JSON.parse(errObject.error.error.body);
            console.log("errBody msg: ", errorBody.error.message);
            res.statusMessage = errorBody.error.message;
            res.status(409).send(`${errorBody.error.message}`);
        }
    }
}

const receiveOutside = async (to_net, from, to, amount) => {
    const provider = new ethers.providers.JsonRpcProvider(`${PROVIDERS[to_net]}`);
    const signer = new ethers.Wallet(process.env.ADMIN, provider);
    const address = getAddress(to_net);
    const mctt = new ethers.Contract(address, artifact.abi, signer);
    const tx = await mctt.receiveOutside(from, to, ethers.utils.parseEther(`${amount}`));
    const receipt = await tx.wait();
    console.log("receipt outside: ", receipt.events);
    return tx.hash;
}

module.exports = { transferOutsideFrom };