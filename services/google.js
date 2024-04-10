const axios = require('axios')

module.exports = {
    google_infos_clientes: async () => {
        try {
            let response = await axios.get("https://script.google.com/macros/s/AKfycbz0dMKEr0OvNl0P3CdYQV0Yew0E2etA_jquJjLohwedzP9xHHgFbCb20BVCUf2QGQ3H/exec")
            return { data: response.data, erro: false }
        }catch(erro) {
            return { erro }
        }
    },
    google_include_cliente: async (id_grupo, taxa, numero_comandos) => {
        console.log('include => ', id_grupo, taxa, numero_comandos)
        try {
            let response = await axios.get("https://script.google.com/macros/s/AKfycbz0dMKEr0OvNl0P3CdYQV0Yew0E2etA_jquJjLohwedzP9xHHgFbCb20BVCUf2QGQ3H/exec?id_grupo="+id_grupo+"&numero_comandos="+numero_comandos+"&taxa="+taxa)
            if ( response.data.resultado == "OK" ) {
                return { resultado: "OK", erro: false }
            }
            return { erro: true }
        }catch(erro) {
            return { erro }
        }
    },
    google_salvar_transacao: async (dadosTransacao) => {
        try {
            let response = await axios.get(`https://script.google.com/macros/s/AKfycbzad9BjynbV28up5XEmunBrNj5Ekh-XDJjJNTuVc0XojfO-J0AsQJPBFSh7h0p9JBtZBw/exec?data=${dadosTransacao.data}&hora=${dadosTransacao.hora}&cliente=${dadosTransacao.cliente}&fluxo=${dadosTransacao.fluxo}&usdt=${dadosTransacao.usdt}&venda=${dadosTransacao.venda}`)
            if ( response.data.ultimoRegistro ) {
                return { ultimoRegistro: response.data.ultimoRegistro, erro: false }
            }
            return { erro: true }
        }catch(erro) {
            return { erro }
        }
    },
    google_cancelar_transacao: async (numeroTransacao) => {
        try {
            let response = await axios.get(`https://script.google.com/macros/s/AKfycbzad9BjynbV28up5XEmunBrNj5Ekh-XDJjJNTuVc0XojfO-J0AsQJPBFSh7h0p9JBtZBw/exec?cancel=${numeroTransacao}`)
            console.log(response.data)
            if ( response.data.cancelou == "SIM" ) {
                return { cancelou: response.data.cancelou, erro: false }
            }
            return { erro: true }
        }catch(erro) {
            return { erro }
        }
    }
}