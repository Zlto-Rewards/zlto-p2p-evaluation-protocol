// Allows us to use ES6 in our migrations and tests.
require('babel-register')
const Web3 = require("web3");
const web3 = new Web3();
const secrets = require('./secrets');
const WalletProvider = require("truffle-wallet-provider");
const Wallet = require('ethereumjs-wallet');

const HDWalletProvider = require("truffle-hdwallet-provider");


let mainNetPrivateKey = new Buffer(secrets.mainnetPK, "hex");
let mainNetWallet = Wallet.fromPrivateKey(mainNetPrivateKey);
let mainNetProvider = new WalletProvider(mainNetWallet, "https://mainnet.infura.io/");

let ropstenPrivateKey = new Buffer(secrets.ropstenPK, "hex");
let ropstenWallet = Wallet.fromPrivateKey(ropstenPrivateKey);
let ropstenProvider = new WalletProvider(ropstenWallet,  "https://ropsten.infura.io/65492b8ee4c14ab59c69a249efcca589");

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*' // Match any network id
    },
    ropsten: {
        provider: new HDWalletProvider(secrets.mnemonic, `https://ropsten.infura.io/${secrets.infuraKey}`),
        network_id: "3",
        gas: 5000000,
        gasPrice: 25000000000,
    },
    mainnet: {
        provider: new HDWalletProvider(secrets.mnemonic, `https://infura.io/${secrets.infuraKey}`),
        network_id: "1",
        gas: 5000000,
        gasPrice: 25000000000,
        confirmations: 2,
    }
  }
}
