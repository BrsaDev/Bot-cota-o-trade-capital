const axios = require('axios')

let baseUrlDev = "https://trade.capstg.dev/api"
let baseUrl = "https://trade.capitual.io/api"

const user = "4614b91b-c2c9-490d-bda3-80a8e7e0a0e2"
const pass = "BdNWAFwtx2aWqVb8vmaagdPWHwQEyKLn7B2HTX5wpKBeXrumv2"
const user_dev = "40a44ff8-7aa7-45f5-b3f7-78e1a3e7bb1c"
const pass_dev = "HmxP7cEKWr2bAAbj4nH7YJR9Yk1LSad4yQMrqGe9BBYS7fPKE7"

module.exports = {
    get_cotas_usdt: async () => {
        try {
            const options = {
                auth: {
                    username: user,
                    password: pass
                }
            }
            let response = await axios.get(baseUrl+"/v1.0/trades/quotation?pair=USDT", options)
            return { cota: response.data.data.fx_rate, erro: false }
        } catch (erro) {
            return { erro }
        }
    }
}
