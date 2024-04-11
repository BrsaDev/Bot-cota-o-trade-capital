const fs = require("fs")
const { 
    google_infos_clientes, google_include_cliente, 
    google_salvar_transacao, google_cancelar_transacao, google_info_conta_banco
} = require("./services/google")
const { get_cotas_usdt } = require("./services/traceCapital")
var { infoClientesTemp } = require("./conexaoClienteCache")

var interval = null
module.exports = {
    deletarArquivo: (path) => {
        if ( fs.existsSync(path)) { fs.unlinkSync(path); return true }
        else return false
    },
    sendMessage: async (client, msg) => {
        console.log('\n\nmessage de ' + msg.from + ' para ' + msg.to + ' com a msg => ' + msg.body, 'autor =>', msg.author)
        // verifica se a variável já está armazenando os dados do cliente, senão armazena pra não ficar a tdo momento buscando as informações
        if ( !infoClientesTemp ) { 
            let response = await google_infos_clientes() 
            if ( !response.erro ) infoClientesTemp = response.data
        }
        // verifica se o id do grupo está no .from ou .to e seta
        if ( msg.from.includes('@g.us') ) { var id_grupo = msg.from } 
        else { var id_grupo = msg.to }

        // verifica de a mensagem está vindo de um grupo, senão para por aqui mesmo
        if ( !id_grupo.includes("@g.us") ) { return true }

        // comando para habilitar algum numero que foi inserido e não tinha acesso
        if ( msg.body == "/lpu" ) {
            let resp = await google_infos_clientes() 
            if ( !resp.erro ) {
                infoClientesTemp = resp.data
                return msg.reply("Liberação para usar comandos feita com sucesso.")
            }
            return msg.reply("Houve um erro ao liberar o uso dos comandos.")
        }

        // inclui novo grupo na planilha e busca os dados do cliente para atualizar na variável cache => [infoClientesTemp]
        if ( msg.body.includes('/include') ) {
            let taxa = msg.body.split(" ")[1]
            let include = await google_include_cliente(id_grupo, taxa, msg.author)
            if ( include.resultado == "OK" ) {
                let res = await google_infos_clientes() 
                if ( !res.erro ) infoClientesTemp = res.data  
                return msg.reply("Grupo incluído na planilha com sucesso!")
            }else {
                return msg.reply("Houve um erro ao incluir o id do grupo, tente novamnete.")
            }            
        }
        if ( typeof infoClientesTemp[id_grupo] != 'undefined' && infoClientesTemp[id_grupo].numero_comandos.includes(msg.author) ) {
            if ( msg.body == "/ref" ) {
                let taxa = infoClientesTemp[id_grupo].taxa
                let countInterval = 1
                interval = setInterval(async () => {
                    let cota = await get_cotas_usdt()
                    if ( countInterval >= 5 ) clearInterval(interval)
                    if ( !cota.erro ) {
                        client.sendMessage(id_grupo, `VALOR USDT = R$${parseFloat(cota.cota + taxa).toFixed(4).toString().replace('.', ',')}`)
                    }else {
                        client.sendMessage(id_grupo, "A api está com instabilidade no momento.")
                        clearInterval(interval)
                    }
                    countInterval++
                }, 3000)
            }
            else if ( msg.body == "." ) {
                clearInterval(interval)
            }
            else if ( msg.body.includes("/order") && msg.body[0] == "/" && msg.body.split(" ").length == 5 && msg.body.includes(" fx ") && operacao(msg) ) {
                let cota = await get_cotas_usdt()
                if ( !cota.erro ) {
                    let taxa = infoClientesTemp[id_grupo].taxa
                    let dataHora = new Date().toLocaleString('pt-BR').substr(0, 20).split('-').reverse().join('/').split(', ')
                    let data = dataHora[0]
                    let hora = dataHora[1]
                    let msgBodySplit = msg.body.split(' ')
                    let qtdeTotal = parseInt(msgBodySplit[1].replace('k', '')) * 1000
                    let cota_taxa = parseFloat(parseFloat(msgBodySplit[3].replace(',', '.')).toFixed(4) + taxa).toFixed(4)
                    let venda =  cota_taxa * qtdeTotal
                    client.sendMessage(id_grupo, `_Detalhes da Operação_:

📅 *Data da Operação:* ${data}
*Hora:* ${hora}

*Cotação:* 1 USDT = R$ ${(cota_taxa).toString().replace('.', ',')} BRL

💵 *Montante em USDT:* ${formatarValor(qtdeTotal)}
💼 *Montante em BRL:* R$${formatarValor(venda, true)}`)
                    let cliente = infoClientesTemp[id_grupo].nome_grupo
                    let fluxo = msgBodySplit[4]
                    let res = await google_salvar_transacao({
                        data,
                        hora,
                        cliente,
                        fluxo,
                        usdt: msgBodySplit[1].replace('k', ''),
                        venda: cota_taxa.toString().replace('.', ',')
                    })
                    if ( !res.erro ) {
                        msg.reply(`Numero da transação = ${ res.ultimoRegistro }`)
                    }else {
                        msg.reply(`Erro ao salvar a transação no banco de dados.`)
                    }
                }
            }
            else if ( msg.body.includes("/cancel") ) {
                if ( msg.body.split(' ').length == 1 ) { return msg.reply("Envie o id da transação.") }
                let resultado = await google_cancelar_transacao(msg.body.split(' ')[1].trim())
                if ( resultado.cancelou ) {
                    msg.reply("A transação foi cancelada.")
                }else {
                    msg.reply("Houve um problema ao cancelar a transação.")
                }
            }
            else if ( msg.body == "/att" ) {
                let info = await google_infos_clientes() 
                if ( !info.erro ) {
                    infoClientesTemp = info.data
                    msg.reply("Atualização dos dados da planilha feito com sucesso.")
                }else { msg.reply("Houve um erro ao atualizar os dados da planilha no bot") }
            }
            else if ( msg.body.includes("/banco") ) {
                let resultado = await google_info_conta_banco(msg.body.split(' ')[1].trim())
                if ( !resultado.erro  ) {
                    client.sendMessage(id_grupo, `*Banco:* ${ resultado.conta_banco.nome_banco }
*Ag:* ${ resultado.conta_banco.agencia }
*Conta Corrente:* ${ resultado.conta_banco.conta_corrente }
*EMPRESA:* ${ resultado.conta_banco.nome_empresa }
*CNPJ:* ${ resultado.conta_banco.cnpj }
*Pix:* ${ resultado.conta_banco.chave_pix }`)
                }
            }
            else if ( msg.body.includes("/help") ) {
                let helpSplit = msg.body.split(" ")
                if ( helpSplit.length == 2 ) var comandos = todosComandos(helpSplit[1])
                else var comandos = todosComandos()
                client.sendMessage(msg.author, comandos)
                msg.reply("comandos enviado no privado.")
            } 
        }
    }
}

function operacao(msg) {
    if ( msg.body.includes("D0") || msg.body.includes("d0") ) return true
    if ( msg.body.includes("D1") || msg.body.includes("d1") ) return true
    if ( msg.body.includes("D2") || msg.body.includes("d2") ) return true
    return false
}
function formatarValor(valor, depoisVirgula=false) {
    if ( depoisVirgula ) var minimumFractionDigits = 2
    else var minimumFractionDigits = 0
    return valor.toLocaleString('pt-BR', { minimumFractionDigits });
}
function todosComandos(id=false) {
    let comandos = {
        "1": `*[1]* Incluir um novo grupo na planilha para liberação dos comandos
*composição do comando:* /include + 1 espaço + taxa do cliente
*exemplo:* /include 0,90`,
        "2": `*[2]* Excluir transação gravada na planilha
*composição do comando:* /cancel + 1 espaço + número da transação
*exemplo:* /cancel 123`,
        "3": `*[3]* Buscar cota e entregar informação com no máximo 5 recebimentos de cota
*composição do comando:* /ref
*exemplo:* /ref`,
        "4": `*[4]* Parar loop da buscar de cota
*composição do comando:* .
*exemplo:* .`,
        "5": `*[5]* Gerar a venda
*composição do comando:* /order + espaço + qtde pedida + espaço + fx + espaço + cota + espaço + operação
*exemplo:* /order 10k fx 5,0329 D0`,
        "6": `*[6]* Liberar primeiro uso de numero que foi inserido para enviar comandos ao bot
*composição do comando:* /lpu
*exemplo:* /lpu`,
        "7": `*[7]* Atualizar dados dos grupos em cache que eventualmente tiveram mudanças
*composição do comando:* /att
*exemplo:* /att`,
        "8": `*[8]* Buscar dados bancários
*composição do comando:* /banco + espaço + id do banco
*exemplo:* /banco 123`,
        '9': `*[9]* Listar todos os comandos disponíveis
*composição do comando:* /help
*exemplo:* /help`,
        "10": `*[10]* Listar comando específico disponível
*composição do comando:* /help + espaço + numero do comando
*exemplo:* /help 1`
    }
    if ( id ) return comandos[id]
    let ultimoItem = `[${ Object.keys(comandos).length }]`
    let listaComandos = ""
    for ( let comando of Object.values(comandos) ) {
        if ( comando.includes(ultimoItem) ) {
            listaComandos += comando
        }else listaComandos += (comando + '\n\n')
    }
    return listaComandos
}


