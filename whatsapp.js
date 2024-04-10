const { Client } = require("whatsapp-web.js");
const qrcode = require('qrcode-terminal');
const qrimage = require('qr-image');
const fs = require(`fs`);
const { sendMessage, deletarArquivo } = require('./utils')
const path = require('path')

const wwebVersion = '2.2412.54';
const session = async function (idCliente) {
 
    const client = new Client({
        webVersionCache: {
            type: 'remote',
            remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${wwebVersion}.html`,
        }
    });
    console.log('iniciando o cliente ' + idCliente)

    client.initialize()

    client.on(`qr`, async (qr) => {
        // qrcode.generate(qr, { small: true });
        let timestamp = Number(new Date())
        let qr_svg = qrimage.image(qr, { type: 'svg' });
        qr_svg.pipe(fs.createWriteStream(`${__dirname}/pages/assets/qr-code-${ idCliente }-${ timestamp }.svg`))

        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        if ( typeof config[idCliente] != 'undefined' ) {
            deletarArquivo(path.join(__dirname, `/pages/assets/${ config[idCliente].nome_qrcode }`)) 
        }
        else config[idCliente] = {}
        config[idCliente] = { nome_qrcode: `qr-code-${ idCliente }-${ timestamp }.svg`, autenticado: false }
        fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
    });

    client.on(`authenticated`, (session) => {
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        config[idCliente].autenticado = true
        fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
        console.log(`Cliente [ ${ idCliente } ] autenticado.`)
    });

    client.on(`auth_failure`, (msg) => {
        console.log(`Houve uma falha com o cliente ${ idCliente }.\n[ MSG ] = auth_failure =>`, msg);
    });

    client.on(`ready`, () => {
        console.log(`Cliente [ ${ idCliente } ] preparado para uso.`);
    });

    client.on(`disconnected`, (reason) => {
        console.log(`disconnected`, reason);
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        config[idCliente].autenticado = false
        fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
    });

    client.on('message_ack', async (msg, ack) => {})
    
    client.on(`message_create`, async msg => {
        if (msg.from == "status@broadcast" || msg.type == "e2e_notification" || msg.type == "protocol") return true
        await sendMessage(client, msg)
    });

    return client;
};

module.exports = session
