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
                return await msg.reply("Liberação para usar comandos feita com sucesso.")
            }
            return await msg.reply("Houve um erro ao liberar o uso dos comandos.")
        }

        // inclui novo grupo na planilha e busca os dados do cliente para atualizar na variável cache => [infoClientesTemp]
        if ( msg.body.includes('/include') ) {
            let taxa = msg.body.split(" ")[1]
            let include = await google_include_cliente(id_grupo, taxa, msg.author)
            if ( include.resultado == "OK" ) {
                let res = await google_infos_clientes() 
                if ( !res.erro ) infoClientesTemp = res.data  
                return await msg.reply("Grupo incluído na planilha com sucesso!")
            }else {
                return await msg.reply("Houve um erro ao incluir o id do grupo, tente novamnete.")
            }            
        }
        if ( typeof infoClientesTemp[id_grupo] != 'undefined' && typeof msg.author != 'undefined' && infoClientesTemp[id_grupo].numero_comandos.includes(msg.author.replace(':1', '')) ) {
            if ( msg.body == "/ref" ) {
                var countInterval = 1
                interval = setInterval(async () => {
                    let cota = await get_cotas_usdt()
                    if ( countInterval == 6 ) {
                        clearInterval(interval)
                        return await client.sendMessage(id_grupo, "off")
                    }
                    if ( !cota.erro ) {
                        let taxaFixaOperacao = parseFloat(( 0.5067 * parseFloat(cota.cota).toFixed(4) ) / 100)
                        let cotaMenosTaxaFixa = parseFloat( parseFloat(cota.cota).toFixed(4) - taxaFixaOperacao ).toFixed(4)
                        let taxa = parseFloat( ( infoClientesTemp[id_grupo].taxa * cotaMenosTaxaFixa ) / 100 ).toFixed(4)
                        let cota_taxa = parseFloat( parseFloat(cotaMenosTaxaFixa) + parseFloat(taxa) ).toFixed(4)
                        await client.sendMessage(id_grupo, `VALOR USDT = R$${parseFloat(cota_taxa).toFixed(4).toString().replace('.', ',')}`)
                    }else {
                        await msg.reply("A api está com instabilidade no momento.")
                        clearInterval(interval)
                    }
                    countInterval++
                }, 3000)
            }
            else if ( msg.body == "." ) {
                clearInterval(interval)
            }
            else if ( msg.body.includes("/order") && msg.body[0] == "/" && msg.body.split(" ").length == 5 && msg.body.includes(" fx ") && operacao(msg) ) {
                let msgBodySplit = msg.body.split(' ')
                let dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).slice(0, 20).split('-').reverse().join('/').split(', ')
                let data = dataHora[0]
                let hora = dataHora[1]
                if ( msgBodySplit[1].includes('k') || msgBodySplit[1].includes('K') ) {
                    var qtdeTotal = formatarValor(parseFloat(msgBodySplit[1].replace('k', '').replace('K', '')) * 1000, true)
                    var usdtPlanilha = qtdeTotal
                }else {
                    var qtdeTotal = msgBodySplit[1]
                    if ( !qtdeTotal.includes(',') ) {
                        qtdeTotal = parseFloat(qtdeTotal.toString().replace('.', ''))
                    }
                    var usdtPlanilha = formatarValor(qtdeTotal, true)
                }
                let cota = parseFloat( parseFloat(msgBodySplit[3].replace(',', '.')) ).toFixed(4)
                let venda =  formatarValor(parseFloat(cota * parseFloat(qtdeTotal.toString().replace('.', ''))), true)
                let hash = criarHash()
                await client.sendMessage(id_grupo, `_Detalhes da Operação_:

*Id operação:* ${hash}
📅 *Data da Operação:* ${data}
*Hora:* ${hora}

*Cotação:* 1 USDT = R$ ${(cota).toString().replace('.', ',')} BRL

💵 *Montante em USDT:* ${formatarValor(qtdeTotal, true)}
💼 *Montante em BRL:* R$${formatarValor(venda, true)}`)
                let cliente = infoClientesTemp[id_grupo].nome_grupo
                let fluxo = msgBodySplit[4]
                let res = await google_salvar_transacao({
                    data,
                    hora,
                    cliente,
                    fluxo,
                    usdt: usdtPlanilha.toString(),
                    venda: cota.toString().replace('.', ','),
                    id_operacao: hash
                })
                if ( res.erro ) {
                    await msg.reply(`Erro ao salvar a transação no banco de dados.`)
                }
            }
            else if ( msg.body.includes("/cancel") ) {
                if ( msg.body.split(' ').length == 1 ) { return await msg.reply("Envie o id da transação.") }
                let resultado = await google_cancelar_transacao(msg.body.split(' ')[1].trim())
                if ( resultado.cancelou ) {
                    await msg.reply("A transação foi cancelada.")
                }else {
                    await msg.reply("Houve um problema ao cancelar a transação.")
                }
            }
            else if ( msg.body == "/att" ) {
                let info = await google_infos_clientes() 
                if ( !info.erro ) {
                    infoClientesTemp = info.data
                    await msg.reply("Atualização dos dados da planilha feito com sucesso.")
                }else { await msg.reply("Houve um erro ao atualizar os dados da planilha no bot") }
            }
            else if ( msg.body.includes("/banco") ) {
                let resultado = await google_info_conta_banco(msg.body.split(' ')[1].trim())
                if ( !resultado.erro  ) {
                    await client.sendMessage(id_grupo, `*Banco:* ${ resultado.conta_banco.nome_banco }
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
                if ( !comandos ) return await msg.reply("Não existe comando com esse número.")
                await client.sendMessage(msg.author, comandos)
                await msg.reply("comandos enviado no privado.")
            } 
        }
    }
}

function criarHash() {
    const caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
    
    let hash = '';
    
    for (let i = 0; i < 2; i++) {
      hash += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    
    for (let i = 0; i < 2; i++) {
      hash += numeros.charAt(Math.floor(Math.random() * numeros.length));
    }
    
    return hash;
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
    if ( id && id > Object.keys(comandos).length ) return false
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


