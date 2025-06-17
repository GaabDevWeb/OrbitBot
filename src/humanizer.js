async function simularRespostaHumana(client, chatId, texto) {
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 200));

    const frases = texto.split(/(?<=[.!?])\s+/).filter(f => f.length > 0);
    let mensagemAtual = '';
    const MAX_LENGTH = 180;

    for (const frase of frases) {
        if ((mensagemAtual + frase).length <= MAX_LENGTH) {
            mensagemAtual += (mensagemAtual ? ' ' : '') + frase;
        } else {
            if (mensagemAtual) {
                await client.sendText(chatId, mensagemAtual);
                await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 150));
                mensagemAtual = '';
            }

            if (frase.length > MAX_LENGTH) {
                const partesLongas = frase.match(/.{1,180}(?:\s|$)/g) || [frase];
                for (const parte of partesLongas) {
                    await client.sendText(chatId, parte.trim());
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            } else {
                mensagemAtual = frase;
            }
        }
    }

    if (mensagemAtual) {
        await client.sendText(chatId, mensagemAtual);
    }
}

module.exports = { simularRespostaHumana };