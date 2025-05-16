const venom = require('venom-bot');
const { handleMessage } = require('./openai');
const { simularRespostaHumana } = require('./humanizer');
const { cadastrarCliente, buscarCliente, atualizarHistorico, buscarHistorico } = require('../database');