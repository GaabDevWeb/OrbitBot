async function simularRespostaHumana(client, chatId, texto) {
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));

    const frases = texto.split(/(?<=[.!?])\s+/).filter(f => f.length > 0);
    let mensagemAtual = '';

    for (const frase of frases) {
        if ((mensagemAtual + frase).length <= 180) {
            mensagemAtual += (mensagemAtual ? ' ' : '') + frase;
        } else {
            if (mensagemAtual) {
                await client.sendText(chatId, mensagemAtual);
                await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
                mensagemAtual = '';
            }

            if (frase.length > 180) {
                const partesLongas = frase.match(/.{1,180}(?:\s|$)/g) || [frase];
                for (const parte of partesLongas) {
                    await client.sendText(chatId, parte.trim());
                    await new Promise(resolve => setTimeout(resolve, 600));
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