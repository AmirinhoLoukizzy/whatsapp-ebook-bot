const venom = require('venom-bot');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Configurações do bot para Moçambique
const CONFIG = {
    BOT_NUMBER: '878477988',
    ADMIN_NUMBER: '849377988', 
    ALLOWED_GROUP: 'Test bot',
    PAYMENT_METHODS: {
        MPESA: '849377988',
        EMOLA: '878477988'
    },
    SUPPORT_EMAIL: 'oliderdigitalmz@proton.me'
};

// Sistema de arquivos
const dataDir = path.join(__dirname, 'data');
const ebooksDir = path.join(__dirname, 'ebooks');

// Criar diretórios se não existirem
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(ebooksDir)) fs.mkdirSync(ebooksDir, { recursive: true });

// Arquivos de dados
const EBOOKS_FILE = path.join(dataDir, 'ebooks.json');
const ORDERS_FILE = path.join(dataDir, 'orders.json');

// ========== SISTEMA DE DADOS ==========
let ebooks = [];
let ebookCounter = 1;
let orders = [];
let orderCounter = 1;
let pendingCustomers = new Set();

// Carregar dados
function loadEbooks() {
    try {
        if (fs.existsSync(EBOOKS_FILE)) {
            const data = fs.readFileSync(EBOOKS_FILE, 'utf8');
            ebooks = JSON.parse(data);
            if (ebooks.length > 0) {
                ebookCounter = Math.max(...ebooks.map(e => e.id)) + 1;
            }
        } else {
            const defaultEbook = {
                id: 1,
                name: "A Arte de Faturar no Digital - Da Venda ao Kanimambo",
                price: 199,
                filename: "faturar-digital.pdf",
                active: true,
                createdAt: new Date().toISOString()
            };
            ebooks = [defaultEbook];
            saveEbooks();
        }
        console.log(`📚 ${ebooks.length} ebooks carregados`);
    } catch (error) {
        console.error('❌ Erro ao carregar ebooks:', error);
        ebooks = [];
    }
}

function saveEbooks() {
    try {
        fs.writeFileSync(EBOOKS_FILE, JSON.stringify(ebooks, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar ebooks:', error);
    }
}

function loadOrders() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const data = fs.readFileSync(ORDERS_FILE, 'utf8');
            orders = JSON.parse(data);
            if (orders.length > 0) {
                orderCounter = Math.max(...orders.map(o => o.id)) + 1;
            }
        }
        console.log(`📦 ${getPendingOrders().length} pedidos pendentes`);
    } catch (error) {
        console.error('❌ Erro ao carregar pedidos:', error);
        orders = [];
    }
}

function saveOrders() {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar pedidos:', error);
    }
}

// ========== FUNÇÕES PRINCIPAIS ==========
function createOrder(customerNumber, customerName, proofType, ebookId, proofContent, paymentMethod) {
    const ebook = getEbookById(ebookId);
    const order = {
        id: orderCounter++,
        customerNumber: customerNumber,
        customerName: customerName,
        ebookId: ebookId,
        ebookName: ebook ? ebook.name : 'Ebook Desconhecido',
        price: ebook ? ebook.price : 0,
        status: 'aguardando_aprovacao',
        proofType: proofType,
        proofContent: proofContent,
        paymentMethod: paymentMethod,
        createdAt: new Date().toISOString(),
        approvedAt: null,
        rejectedAt: null
    };
    
    orders.push(order);
    saveOrders();
    addPendingCustomer(customerNumber);
    console.log(`📦 Pedido #${order.id} criado para ${customerName}`);
    return order;
}

function findOrder(orderId) {
    return orders.find(order => order.id === parseInt(orderId));
}

function getPendingOrders() {
    return orders.filter(order => order.status === 'aguardando_aprovacao');
}

function getActiveEbooks() {
    return ebooks.filter(ebook => ebook.active);
}

function getEbookById(ebookId) {
    return ebooks.find(ebook => ebook.id === parseInt(ebookId));
}

// ========== SISTEMA DE BLOQUEIO ==========
function hasPendingOrder(customerNumber) {
    return pendingCustomers.has(customerNumber) || 
           orders.some(order => 
               order.customerNumber === customerNumber && 
               order.status === 'aguardando_aprovacao'
           );
}

function addPendingCustomer(customerNumber) {
    pendingCustomers.add(customerNumber);
}

function removePendingCustomer(customerNumber) {
    pendingCustomers.delete(customerNumber);
}

function getCustomerPendingOrder(customerNumber) {
    return orders.find(order => 
        order.customerNumber === customerNumber && 
        order.status === 'aguardando_aprovacao'
    );
}

// ========== DETECÇÃO DE PAGAMENTO ==========
function detectPaymentMethod(content) {
    const text = content.trim();
    
    if (text.toLowerCase().startsWith('confirmado')) {
        return { method: 'M-PESA', valid: true, icon: '📱' };
    }
    
    if (text.toLowerCase().startsWith('id da transacao') || text.toLowerCase().startsWith('id da transação')) {
        return { method: 'E-MOLA', valid: true, icon: '💰' };
    }
    
    if (text.toLowerCase().includes('mpesa') || text.toLowerCase().includes('m-pesa')) {
        return { method: 'M-PESA', valid: true, icon: '📱' };
    }
    
    if (text.toLowerCase().includes('emola') || text.toLowerCase().includes('e-mola')) {
        return { method: 'E-MOLA', valid: true, icon: '💰' };
    }
    
    if (text.toLowerCase().includes('comprovante') || text.toLowerCase().includes('pagamento') || text.toLowerCase().includes('transferencia')) {
        return { method: 'Aguardando verificação', valid: true, icon: '📄' };
    }
    
    return { method: 'Não identificado', valid: false, icon: '❓' };
}

// ========== FUNÇÕES DE MENSAGENS ==========
async function sendPurchaseInstructions(client, chatId) {
    const activeEbooks = getActiveEbooks();
    
    let instructions = `📚 *CATÁLOGO DE EBOOKS* 📚\n\n`;
    
    activeEbooks.forEach(ebook => {
        instructions += `${ebook.id}📖 *${ebook.name}* - ${ebook.price} MZN\n`;
    });

    instructions += `
💳 *PAGAMENTO:*
📱 M-PESA: ${CONFIG.PAYMENT_METHODS.MPESA}
💰 E-mola: ${CONFIG.PAYMENT_METHODS.EMOLA}

📋 *COMO COMPRAR:*
1. Digite o *NÚMERO* do ebook desejado (ex: 1)
2. Faça o pagamento via M-PESA ou E-mola
3. Envie o comprovante (foto ou texto)
4. Aguarde a aprovação
5. Receba seu ebook automaticamente

📧 *SUPORTE:* ${CONFIG.SUPPORT_EMAIL}
🤖 *CONTATO:* ${CONFIG.BOT_NUMBER}`;

    await client.sendText(chatId, instructions);
}

async function sendEbook(client, customerNumber, ebookId) {
    try {
        const ebook = getEbookById(ebookId);
        if (!ebook) throw new Error('Ebook não encontrado');

        let ebookPath = path.join(ebooksDir, ebook.filename);
        
        if (!fs.existsSync(ebookPath)) {
            const files = fs.readdirSync(ebooksDir);
            const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
            if (pdfFiles.length > 0) {
                ebookPath = path.join(ebooksDir, pdfFiles[0]);
            } else {
                throw new Error('Nenhum arquivo PDF encontrado');
            }
        }

        // Enviar arquivo
        await client.sendFile(
            customerNumber,
            ebookPath,
            `${ebook.name}.pdf`,
            `📖 *EBOOK ENTREGUE!* 📖\n\n*${ebook.name}*\n\nObrigado pela sua compra! 💎\nAproveite a leitura! 🚀\n\n📧 Dúvidas: ${CONFIG.SUPPORT_EMAIL}`
        );

        console.log(`📤 Ebook enviado para ${customerNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar ebook:', error);
        await client.sendText(customerNumber, `❌ Erro ao enviar ebook. Contate: ${CONFIG.SUPPORT_EMAIL}`);
        return false;
    }
}

// ========== INICIALIZAÇÃO DO BOT ==========
console.log('🇲🇿 Iniciando Bot WhatsApp para Moçambique...');
console.log('🤖 Número do Bot:', CONFIG.BOT_NUMBER);
console.log('👨‍💼 Admin:', CONFIG.ADMIN_NUMBER);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Carregar dados
loadEbooks();
loadOrders();

// Iniciar Venom Bot
venom
    .create({
        session: 'ebook-bot-mz',
        headless: true,
        useChrome: false,
        browserArgs: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    .then((client) => {
        start(client);
    })
    .catch((error) => {
        console.log('❌ Erro ao iniciar bot:', error);
    });

function start(client) {
    console.log('✅ Bot conectado com sucesso!');

    // Evento de mensagem
    client.onMessage(async (message) => {
        try {
            if (message.isGroupMsg) return;

            const messageBody = message.body ? message.body.trim() : '';
            const messageLower = messageBody.toLowerCase();
            const chatId = message.from;
            const customerName = message.sender.pushname || 'Cliente';

            console.log(`\n📩 ${customerName}: ${messageBody.substring(0, 30)}...`);

            // 📱 COMPORTAMENTO PARA CLIENTES
            if (message.from !== CONFIG.ADMIN_NUMBER) {
                // Verificar bloqueio
                if (hasPendingOrder(chatId) && !messageLower.startsWith('status')) {
                    const pendingOrder = getCustomerPendingOrder(chatId);
                    if (pendingOrder) {
                        await client.sendText(chatId, `⏳ *PROCESSAMENTO EM ANDAMENTO* - #${pendingOrder.id}

📋 Sua transação está sendo processada pelo nosso sistema de validação.

📚 *Produto:* ${pendingOrder.ebookName}
💎 *Valor:* ${pendingOrder.price} MZN
📱 *Método:* ${pendingOrder.paymentMethod}
⏰ *Iniciado:* ${new Date(pendingOrder.createdAt).toLocaleString('pt-BR')}

💡 *Comandos disponíveis:*
• \`status ${pendingOrder.id}\` - Ver status detalhado
• \`suporte\` - Contatar nossa equipe

⚠️ *Aguarde a conclusão do processamento atual* antes de iniciar nova transação.`);
                        return;
                    }
                }

                // Comando menu
                if (messageLower === 'menu') {
                    await sendPurchaseInstructions(client, chatId);
                    return;
                }

                // Seleção de ebook
                const ebookNumber = parseInt(messageBody);
                const activeEbooks = getActiveEbooks();
                const selectedEbook = activeEbooks.find(ebook => ebook.id === ebookNumber);

                if (selectedEbook) {
                    await client.sendText(chatId, `📚 *${selectedEbook.name.toUpperCase()}* - ${selectedEbook.price} MZN

💳 *FAÇA O PAGAMENTO:*
📱 M-PESA: ${CONFIG.PAYMENT_METHODS.MPESA}
💰 E-mola: ${CONFIG.PAYMENT_METHODS.EMOLA}

💎 *VALOR:* ${selectedEbook.price} MZN

📋 *PRÓXIMO PASSO:*
Envie o *COMPROVANTE* de pagamento (foto ou texto) para finalizar a compra.`);
                    return;
                }

                // Processar comprovante
                const hasMedia = message.type === 'image' || message.type === 'document';
                const paymentDetection = detectPaymentMethod(messageBody);
                const isProof = hasMedia || paymentDetection.valid;
                const selectedEbookId = activeEbooks.length > 0 ? activeEbooks[0].id : 1;

                if (isProof) {
                    let proofContent = messageBody;
                    
                    if (hasMedia) {
                        proofContent = '[IMAGEM] Comprovante enviado';
                    }

                    if (!paymentDetection.valid && !hasMedia) {
                        await client.sendText(chatId, `❌ *COMPROVANTE INVÁLIDO*

⚠️ Envie um comprovante legível que contenha:
• "Confirmado" (M-PESA)
• "ID da transação" (E-mola)  
• Ou imagem do comprovante

📧 Dúvidas: ${CONFIG.SUPPORT_EMAIL}`);
                        return;
                    }

                    const ebook = getEbookById(selectedEbookId);
                    const order = createOrder(chatId, customerName, 
                        hasMedia ? 'imagem' : 'texto', selectedEbookId, proofContent, paymentDetection.method);

                    // Confirmar para cliente
                    let clientResponse = `✅ *COMPROVANTE RECEBIDO!*\n\n`;
                    
                    if (paymentDetection.method === 'M-PESA') {
                        clientResponse += `📱 *Detectamos pagamento via M-PESA*\n⏳ Processando sua transação...\n📖 Seu ebook será enviado em instantes!`;
                    } else if (paymentDetection.method === 'E-MOLA') {
                        clientResponse += `💰 *Detectamos pagamento via E-MOLA*\n⏳ Processando sua transação...\n📖 Seu ebook será enviado em instantes!`;
                    } else {
                        clientResponse += `📋 *Comprovante recebido*\n⏳ Aguarde a verificação...\n📖 Seu ebook será enviado após aprovação!`;
                    }

                    clientResponse += `\n\n📋 *Pedido #${order.id} registrado*
👤 Cliente: ${customerName}
📚 Produto: ${ebook.name}
💎 Valor: ${ebook.price} MZN
⏰ Data: ${new Date().toLocaleString('pt-BR')}

📧 Suporte: ${CONFIG.SUPPORT_EMAIL}`;

                    await client.sendText(chatId, clientResponse);

                    // Notificar admin
                    const methodIcon = paymentDetection.icon;
                    await client.sendText(CONFIG.ADMIN_NUMBER, 
                        `${methodIcon} *COMPROVANTE ${paymentDetection.method.toUpperCase()} RECEBIDO* - #${order.id}

👤 *Cliente:* ${customerName}
📞 *Número:* ${chatId}
📚 *Produto:* ${ebook.name}
💰 *Valor:* ${ebook.price} MZN
📱 *Método:* ${paymentDetection.method}

📋 *COMPROVANTE:*
"${proofContent.substring(0, 100)}"

✅ *aprovar ${order.id}*
❌ *recusar ${order.id}*`);

                    return;
                }

                // Comando não reconhecido
                if (messageBody && !messageLower.startsWith('!') && !messageLower.startsWith('/')) {
                    await sendPurchaseInstructions(client, chatId);
                }
            }

            // 👨‍💼 COMPORTAMENTO PARA ADMIN
            if (message.from === CONFIG.ADMIN_NUMBER) {
                console.log(`👨‍💼 Admin: ${messageBody}`);

                // Listar pedidos
                if (messageLower === '/pedidos') {
                    const pendingOrders = getPendingOrders();
                    
                    if (pendingOrders.length === 0) {
                        await client.sendText(chatId, '📋 *PEDIDOS*\n\n🎉 Nenhum pedido pendente!');
                        return;
                    }

                    let ordersList = `📋 *PEDIDOS PENDENTES: ${pendingOrders.length}*\n\n`;
                    pendingOrders.forEach(order => {
                        ordersList += `🆔 *Pedido #${order.id}*\n`;
                        ordersList += `👤 ${order.customerName}\n`;
                        ordersList += `📚 ${order.ebookName}\n`;
                        ordersList += `💎 ${order.price} MZN\n`;
                        ordersList += `📱 ${order.paymentMethod}\n`;
                        ordersList += `✅ *aprovar ${order.id}* | ❌ *recusar ${order.id}*\n`;
                        ordersList += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                    });

                    await client.sendText(chatId, ordersList);
                    return;
                }

                // Aprovar pedido
                if (messageLower.startsWith('aprovar ')) {
                    const orderId = messageLower.split(' ')[1];
                    const order = findOrder(orderId);

                    if (!order) {
                        await client.sendText(chatId, `❌ Pedido #${orderId} não encontrado.`);
                        return;
                    }

                    order.status = 'aprovado';
                    order.approvedAt = new Date().toISOString();
                    saveOrders();
                    removePendingCustomer(order.customerNumber);

                    const success = await sendEbook(client, order.customerNumber, order.ebookId);

                    if (success) {
                        await client.sendText(chatId, `✅ *PEDIDO #${orderId} APROVADO!*\n\n📤 Ebook enviado para: ${order.customerName}`);
                        console.log(`✅ Pedido #${orderId} aprovado`);
                    }

                    return;
                }

                // Recusar pedido
                if (messageLower.startsWith('recusar ')) {
                    const orderId = messageLower.split(' ')[1];
                    const order = findOrder(orderId);

                    if (!order) {
                        await client.sendText(chatId, `❌ Pedido #${orderId} não encontrado.`);
                        return;
                    }

                    order.status = 'recusado';
                    order.rejectedAt = new Date().toISOString();
                    saveOrders();
                    removePendingCustomer(order.customerNumber);

                    await client.sendText(order.customerNumber, 
                        `❌ *PEDIDO #${orderId} RECUSADO!*\n\nSua transação não foi aprovada pelo nosso sistema.\n\n📧 Contate: ${CONFIG.SUPPORT_EMAIL}`);

                    await client.sendText(chatId, `❌ *PEDIDO #${orderId} RECUSADO!*\n\n👤 Cliente notificado.`);

                    console.log(`❌ Pedido #${orderId} recusado`);
                    return;
                }
            }

        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    });

    console.log('🤖 Bot pronto para receber mensagens!');
    console.log('📱 Escaneie o QR Code se aparecer...');
}
