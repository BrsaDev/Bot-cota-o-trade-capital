const express = require('express')
const fs = require('fs')
const path = require('path')
const session = require('./whatsapp')
let { conexaoClientes } = require('./conexaoClienteCache')
const { deletarArquivo } = require('./utils')



try {
    let port = process.env.PORT || 3000
    const app = express()
    // app.use(express.limit(100000000));
    app.use(express.urlencoded({ extended: false, limit: '50mb' }))
    app.use(express.json({ limit: '50mb' }));
    app.use(express.static('pages'))

    app.get('/', (req, res) => {
        return res.sendFile(path.join(__dirname, '/pages/home.html'))
    })

    app.get('/qr-code', (req, res) => {
        let { idCliente } = req.query
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        try {
            return res.json({
                nome_qrcode: (config[idCliente].nome_qrcode || false),
                autenticado: (config[idCliente].autenticado || false)
            })
        } catch (e) {
            return res.json({
                nome_qrcode: false,
                autenticado: false
            })
        }
    })

    app.post('/check-user-conect', (req, res) => {
        let { idCliente } = req.body
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        if (typeof config[idCliente] != 'undefined' && config[idCliente].autenticado) {
            return res.json({ status: 'connected' })
        }
        return res.json({ status: 'disconnected' })
    })

    app.post('/iniciar-sessao', async (req, res) => {
        let { idCliente } = req.body
        if (typeof conexaoClientes[idCliente] == 'undefined') {
            conexaoClientes[idCliente] = await session(idCliente)
        }
        return res.json({ status: 'OK' })
    })

    app.post('/fechar-sessao', async (req, res) => {
        let { idCliente } = req.body
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        if ( typeof config[idCliente] != 'undefined' ) {
            config[idCliente].autenticado = false
            fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config)) 
            await conexaoClientes[idCliente].logout()
            delete conexaoClientes[idCliente]
        }        
        return res.json({ status: 'OK' })
    })

    app.listen(port, () => { console.log('Rodando as rotas na porta: ' + port) })

    process.on('SIGINT', (e) => { console.log(e); process.exit() })
    process.on('SIGQUIT', (e) => { console.log(e); process.exit() })
    process.on('SIGTERM', (e) => { console.log(e); process.exit() })
    process.on('exit', (code) => {
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        if (Object.keys(config).length > 0) {
            for (let key of Object.keys(config)) {
                deletarArquivo(path.join(__dirname, `/pages/assets/${ config[key].nome_qrcode }`))
                delete config[key]
            }
        }
        fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
        console.log('Fechando o processo com o código: ', code);
    });
} catch (e) {
    process.on('SIGINT', (e) => { console.log(e); process.exit() })
    process.on('SIGQUIT', (e) => { console.log(e); process.exit() })
    process.on('SIGTERM', (e) => { console.log(e); process.exit() })
    process.on('exit', (code) => {
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        if (Object.keys(config).length > 0) {
            for (let key of Object.keys(config)) {
                deletarArquivo(path.join(__dirname, `/pages/assets/${ config[key].nome_qrcode }`))
                delete config[key]
            }
        }
        fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
        console.log('Fechando o processo com o código: ', code);
    });
}



// var { get_cotas_usdt } = require('./services/traceCapital')
// async function e(){
//     let cota = await get_cotas_usdt()
//     console.log(cota)
// }
// e()