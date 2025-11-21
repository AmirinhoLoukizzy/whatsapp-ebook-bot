const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Configurações
const CONFIG = {
    BOT_NUMBER: '878477988',
    ADMIN_NUMBER: '849377988',
    EBOOK_PRICE: '199 MZN',
    PAYMENT_MPESA: '849377988',
    PAYMENT_EMOLA: '878477988',
    SUPPORT_EMAIL: 'oliderdigitalmz@proton.me'
};

// Sistema simples
let orders = [];
let orderCounter = 1;

console.log('🇲🇿 Iniciando Bot WhatsApp...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "ebook-bot"
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

I
// Alternativa: Gerar link do QR Code
client.on('qr', (qr) => {
    console.log('\n📱 ACESSE ESTE LINK NO CELULAR:');
    console.log('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qr));
    console.log('\nOu escaneie o QR abaixo (use ZOOM):');
    qrcode.generate(qr, { small: true });
});

// Bot pronto
client.on('ready', () => {
    console.log('✅ BOT CONECTADO!');
});

// Processar mensagens
client.on('message', async (message) => {
    try {
        if (message.fromMe) return;

        const chat = await message.getChat();
        const messageBody = message.body ? message.body.toLowerCase().trim() : '';

        // 📱 PARA CLIENTES
        if (!chat.isGroup) {
            
            // Comando menu
            if (messageBody === 'menu') {
                const menu = `📚 *EBOOK: A Arte de Faturar no Digital*

💳 *PAGAMENTO:*
📱 M-PESA: ${CONFIG.PAYMENT_MPESA}
💰 E-mola: ${CONFIG.PAYMENT_EMOLA}

💎 *VALOR:* ${CONFIG.EBOOK_PRICE}

📋 *COMO COMPRAR:*
1. Faça o pagamento
2. Envie o comprovante (foto ou texto)
3. Aguarde a aprovação
4. Receba seu ebook automaticamente

📧 Suporte: ${CONFIG.SUPPORT_EMAIL}`;

                await message.reply(menu);
                return;
            }

            // Processar comprovante
            const isProof = message.hasMedia || 
                           messageBody.includes('comprovante') || 
                           messageBody.includes('pagamento') ||
                           messageBody.includes('mpesa') ||
                           messageBody.includes('emola');

            if (isProof) {
                // Criar pedido
                const contact = await message.getContact();
                const customerName = contact.name || contact.pushname || 'Cliente';
                
                const order = {
                    id: orderCounter++,
                    customerNumber: message.from,
                    customerName: customerName,
                    status: 'pendente',
                    proofType: message.hasMedia ? 'imagem' : 'texto',
                    createdAt: new Date().toLocaleString('pt-BR')
                };
                
                orders.push(order);

                // Confirmar para cliente
                await message.reply(`✅ *COMPROVANTE RECEBIDO!*

📋 Pedido #${order.id} registrado
⏳ Aguarde a aprovação

📧 Suporte: ${CONFIG.SUPPORT_EMAIL}`);

                // Notificar admin
                await client.sendMessage(
                    `${CONFIG.ADMIN_NUMBER}@c.us`,
                    `🆕 *NOVO PEDIDO #${order.id}*

👤 ${customerName}
📞 ${message.from}
📄 ${order.proofType}
⏰ ${order.createdAt}

✅ *aprovar ${order.id}*
❌ *recusar ${order.id}*`
                );

                return;
            }

            // Comando não reconhecido
            if (messageBody) {
                await message.reply(`💡 Digite "menu" para ver instruções de compra`);
            }
        }

        // 👨‍💼 PARA ADMIN
        if (message.from === `${CONFIG.ADMIN_NUMBER}@c.us` && !chat.isGroup) {
            
            // Aprovar pedido
            if (messageBody.startsWith('aprovar ')) {
                const orderId = messageBody.split(' ')[1];
                const order = orders.find(o => o.id == orderId);

                if (order && order.status === 'pendente') {
                    order.status = 'aprovado';
                    
                    // Enviar ebook
                    const ebookPath = path.join(__dirname, 'ebooks', 'faturar-digital.pdf');
                    if (fs.existsSync(ebookPath)) {
                        const ebook = MessageMedia.fromFilePath(ebookPath);
                        await client.sendMessage(order.customerNumber, ebook);
                        await client.sendMessage(order.customerNumber, 
                            `📖 *EBOOK ENTREGUE!* 📖\n\nObrigado pela compra! 💎\nAproveite a leitura!`);
                    }

                    await message.reply(`✅ Pedido #${orderId} aprovado! Ebook enviado.`);
                }
                return;
            }

            // Recusar pedido
            if (messageBody.startsWith('recusar ')) {
                const orderId = messageBody.split(' ')[1];
                const order = orders.find(o => o.id == orderId);

                if (order && order.status === 'pendente') {
                    order.status = 'recusado';
                    await client.sendMessage(order.customerNumber, 
                        `❌ Pedido #${orderId} recusado.\n📧 Contate: ${CONFIG.SUPPORT_EMAIL}`);
                    await message.reply(`❌ Pedido #${orderId} recusado.`);
                }
                return;
            }

            // Listar pedidos
            if (messageBody === 'pedidos') {
                const pending = orders.filter(o => o.status === 'pendente');
                
                if (pending.length === 0) {
                    await message.reply('📋 Nenhum pedido pendente');
                } else {
                    let list = `📋 PEDIDOS PENDENTES: ${pending.length}\n\n`;
                    pending.forEach(order => {
                        list += `🆔 #${order.id} - ${order.customerName}\n`;
                        list += `📞 ${order.customerNumber}\n`;
                        list += `📄 ${order.proofType}\n`;
                        list += `⏰ ${order.createdAt}\n`;
                        list += `✅ aprovar ${order.id} | ❌ recusar ${order.id}\n\n`;
                    });
                    await message.reply(list);
                }
                return;
            }
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    }
});

// Iniciar bot
client.initialize();

// Tratamento de erros
client.on('disconnected', (reason) => {
    console.log('❌ Bot desconectado:', reason);
    console.log('🔄 Reiniciando...');
    setTimeout(() => client.initialize(), 5000);
});


