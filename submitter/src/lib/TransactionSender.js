
const Tx = require('ethereumjs-tx');
const ethUtils = require('ethereumjs-util');
const utils = require('./utils.js');

module.exports = class TransactionSender {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;
        this.chainId = null;
        this.gasLimit = this.numberToHexString(6500000);
    }

    async getNonce(address) {
        return this.client.eth.getTransactionCount(address, "pending");
    }

    numberToHexString(number) {
        if (!number) {
            return '0x0';
        }
        return `0x${number.toString(16)}`;
    }

    async createRawTransaction(from, to, data, value) { 
        const nonce = await this.getNonce(from);
        const chainId =  this.chainId || await this.client.eth.net.getId();
        const gasPrice = await this.client.eth.getGasPrice();
        let rawTx = {
            gasPrice: this.numberToHexString(gasPrice),
            gas: this.gasLimit,
            value: this.numberToHexString(value),
            to: to,
            data: data,
            from: from,
            nonce: this.numberToHexString(nonce),
            r: 0,
            s: 0,
            v: chainId
        }
        return rawTx;
    }

    signRawTransaction(rawTx, privateKey) {
        let tx = new Tx(rawTx);
        tx.sign(utils.hexStringToBuffer(privateKey));
        return tx;
    }

    async sendSignedTransaction(signedTx) {;  
        const serializedTx = ethUtils.bufferToHex(signedTx.serialize());
        return this.client.eth.sendSignedTransaction(serializedTx);
    }

    async getAddress(privateKey) {
        let address = null;
        if (privateKey && privateKey.length) {
            address = utils.privateToAddress(privateKey);
        } else {
            //If no private key provided we use personal (personal is only for testing)
            let accounts = await this.client.eth.getAccounts();
            address = accounts[0];
        }
        return address;
    }

    async sendTransaction(to, data, value, privateKey) {
        var from = null;
        const stack = new Error().stack;
        try {
            from = await this.getAddress(privateKey);
            //Dry run to check for errores before sending the actual transaction
            await this.client.eth.call({from:from, to:to, data:data});
            const prevConfirmations = this.client.eth.transactionConfirmationBlocks;
            this.client.eth.transactionConfirmationBlocks = 1;
            const rawTx = await this.createRawTransaction(from, to, data, value);
            let sendTransactionPromise = null;
            if (privateKey && privateKey.length) {            
                let signedTx = this.signRawTransaction(rawTx, privateKey);
                sendTransactionPromise = this.sendSignedTransaction(signedTx);
            } else {
                //If no private key provided we use personal (personal is only for testing)
                //await this.client.eth.personal.unlockAccount(from);
                delete rawTx.r;
                delete rawTx.s;
                delete rawTx.v;
                sendTransactionPromise = this.client.eth.sendTransaction(rawTx);
            }
            return sendTransactionPromise.then((receipt) => {
                    this.client.eth.transactionConfirmationBlocks = prevConfirmations;
                    if(receipt.status == 1) {
                        this.logger.info(`Transaction Successful txHash:${receipt.transactionHash} blockNumber:${receipt.blockNumber}`);
                        return receipt;    
                    }
                    this.logger.error('Transaction Failed', receipt);
                    this.logger.error('RawTx that failed', rawTx);
                    throw new Error('Transaction Failed:' + stack);                
                }).catch((err) => {
                    this.logger.error('sendTransaction Exception', err);
                    this.logger.error('RawTx that failed', rawTx);
                    throw new Error('Transaction Failed:' + stack);
                });
        } catch(err) {
            this.logger.error('sendTransaction call Exception', err);
            this.logger.error('data that failed', {from:from, to:to, data:data});
            throw new Error('Call Failed:' + stack);
        }
    }

}