// var ConvertLib = artifacts.require("./ConvertLib.sol");
// var MetaCoin = artifacts.require("./MetaCoin.sol");
var Zlto = artifacts.require("./Zlto.sol");

module.exports = function(deployer, network, accounts) {
    let deployAddress = accounts[0];
    console.log('deploying from:' + deployAddress);
    deployer.deploy(Zlto, {from: deployAddress});
};
