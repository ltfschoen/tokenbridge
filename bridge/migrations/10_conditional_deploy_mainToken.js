
const MainToken = artifacts.require('MainToken');

function shouldDeployToken(network) {
    return !network.toLowerCase().includes('mainnet');
}

module.exports = async (deployer, networkName, accounts) => {
    if(shouldDeployToken(networkName)) {
        return deployer.deploy(MainToken, 'MAIN', 'MAIN', 18, web3.utils.toWei('1000'));
    }
}