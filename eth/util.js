require('dotenv').config();
var Web3 = require('web3');
const truffle = require("truffle-contract");
const ZltoJSON = require("./zlto_truffle/build/contracts/ZltoStorage.json");
const ZltoContract = truffle(ZltoJSON);

const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/${process.env.INFURA_API_KEY}`))

async function contractAtAddress(addr) {
    const abi = ZltoJSON.abi;
    let contract = new web3.eth.Contract(abi, addr);
    return contract;
}

module.exports = {
    contractAtAddress,
    web3
};
