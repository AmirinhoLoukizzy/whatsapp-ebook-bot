const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Configuração para Render
// ========== LIMPEZA DE SESSÕES ANTIGAS ==========
if (process.env.NODE_ENV === 'production') {
    console.log('🔧 Ambiente de produção detectado');
    
    // Limpar sessões antigas do WhatsApp Web.js
    const sessionPath = './.wwebjs_auth';
    const fs = require('fs');
    const path = require('path');
    
    if (fs.existsSync(sessionPath)) {
        console.log('🔄 Limpando sessões antigas...');
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('✅ Sessões antigas removidas');
        } catch (error) {
            console.log('⚠️ Não foi possível limpar sessões:', error.message);
        }
    }
}

// ========== SISTEMA DE CONTROLE DE NOVOS CHATS ==========
let knownChats = new Set();

// Verificar se é primeira interação
async function isFirstInteraction(chat, message) {
    const chatId = chat.id._serialized;
    
    // Se já conhecemos este chat, não é novo
    if (knownChats.has(chatId)) {
        return false;
    }
    
    // Se é grupo, não é novo chat pessoal
    if (chat.isGroup) {
        return false;
    }
    
    // Se a mensagem é de um admin, não enviar boas-vindas
    if (message.from === ADMIN_NUMBER_FORMATTED) {
        return false;
    }
    
    return true;
}

// Marcar chat como conhecido
async function markChatAsNotNew(chat) {
    const chatId = chat.id._serialized;
    knownChats.add(chatId);
    saveKnownChats();
}

// Carregar chats conhecidos do arquivo
function loadKnownChats() {
    try {
        const knownChatsFile = path.join(dataDir, 'known_chats.json');
        if (fs.existsSync(knownChatsFile)) {
            const data = fs.readFileSync(knownChatsFile, 'utf8');
            const loadedChats = JSON.parse(data);
            knownChats = new Set(loadedChats);
            console.log(`💾 ${knownChats.size} chats conhecidos carregados`);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar chats conhecidos:', error);
    }
}

// Salvar chats conhecidos
function saveKnownChats() {
    try {
        const knownChatsFile = path.join(dataDir, 'known_chats.json');
        const chatsArray = Array.from(knownChats);
        fs.writeFileSync(knownChatsFile, JSON.stringify(chatsArray, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar chats conhecidos:', error);
    }
}

// Função de boas-vindas para novos chats
async function sendWelcomeMessage(chat, contact) {
    const customerName = contact.name || contact.pushname || 'Cliente';
    
    const welcomeMessage = `Prezado(a) *${customerName}*,

É uma honra recebê-lo(a) como nosso cliente!

🤖 *SISTEMA AUTOMATIZADO DE PAGAMENTOS*
Oferecemos um processo 100% automático e seguro para aquisição de produtos digitais.

💳 *FORMAS DE PAGAMENTO:*

📱 *M-PESA*
• Número: ${CONFIG.PAYMENT_METHODS.MPESA}
• Titular: *Amiro Carlos*

💰 *E-MOLA* 
• Número: ${CONFIG.PAYMENT_METHODS.EMOLA}
• Titular: *Amiro Carlos*

📋 *COMO ADQUIRIR SEU PRODUTO:*

1. Digite \`menu\` para ver nosso catálogo
2. Escolha o número do produto desejado
3. Realize o pagamento via M-PESA ou E-mola
4. Envie o comprovante (imagem ou texto)
5. Receba acesso imediato ao produto

💡 *PARA APROVEITAR AO MÁXIMO:*

• Dedique tempo para leitura e prática diária
• Execute os exercícios e atividades propostas
• Aplique as estratégias adaptadas à realidade moçambicana
• Partilhe suas experiências e resultados

🎁 *BENEFÍCIOS INCLUSOS:*
✅ Acesso vitalício ao conteúdo
✅ Atualizações gratuitas futuras
✅ Suporte técnico especializado
✅ Conteúdo adaptado para Moçambique

📞 *PRECISA DE AJUDA?*
Estamos aqui para apoiar sua jornada!

Use o comando \`/suporte "sua mensagem"\` para contactar diretamente nossa equipe.

💡 *EXEMPLOS:*
• \`/suporte "Preciso de ajuda com o pagamento"\`
• \`/suporte "Não recebi o produto após pagamento"\`
• \`/suporte "Dúvidas sobre o conteúdo"\`

🕒 *Horário de atendimento:* Segunda a Sexta, 8h-18h

💎 *Investimento no seu conhecimento - Resultados para a vida!*`;

    await chat.sendMessage(welcomeMessage);
    console.log(`👋 Mensagem de boas-vindas enviada para ${customerName}`);
}

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

// Formatar número para padrão WhatsApp
function formatNumber(number) {
    let cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.startsWith('8') && cleanNumber.length === 9) {
        cleanNumber = '258' + cleanNumber;
    }
    if (cleanNumber.length === 12) {
        return cleanNumber + '@c.us';
    }
    return cleanNumber + '@c.us';
}

// Números formatados
const BOT_NUMBER_FORMATTED = formatNumber(CONFIG.BOT_NUMBER);
const ADMIN_NUMBER_FORMATTED = formatNumber(CONFIG.ADMIN_NUMBER);

// ========== SISTEMA DE ARQUIVOS ==========
const dataDir = path.join(__dirname, 'data');
const ebooksDir = path.join(__dirname, 'ebooks');

// Criar diretórios se não existirem
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(ebooksDir)) fs.mkdirSync(ebooksDir, { recursive: true });

// Arquivos de dados
const EBOOKS_FILE = path.join(dataDir, 'ebooks.json');
const ORDERS_FILE = path.join(dataDir, 'orders.json');
const LOGS_FILE = path.join(dataDir, 'admin_logs.json');
const SALES_FILE = path.join(dataDir, 'sales_report.json');

// ========== SISTEMA DE EBOOKS ==========
let ebooks = [];
let ebookCounter = 1;

// Carregar ebooks do arquivo
function loadEbooks() {
    try {
        if (fs.existsSync(EBOOKS_FILE)) {
            const data = fs.readFileSync(EBOOKS_FILE, 'utf8');
            ebooks = JSON.parse(data);
            if (ebooks.length > 0) {
                ebookCounter = Math.max(...ebooks.map(e => e.id)) + 1;
            }
        } else {
            // Ebook padrão inicial
            const defaultEbook = {
                id: 1,
                name: "A Arte de Faturar no Digital - Da Venda ao Kanimambo",
                price: 199,
                filename: "faturar-digital.pdf",
                active: true,
                createdAt: new Date().toISOString(),
                salesCount: 0
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

// Salvar ebooks no arquivo
function saveEbooks() {
    try {
        fs.writeFileSync(EBOOKS_FILE, JSON.stringify(ebooks, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar ebooks:', error);
    }
}

// ========== SISTEMA DE PEDIDOS ==========
let orders = [];
let orderCounter = 1;

// Carregar pedidos do arquivo
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

// Salvar pedidos no arquivo
function saveOrders() {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar pedidos:', error);
    }
}

// ========== FUNÇÕES PRINCIPAIS ==========

// Criar novo pedido
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
    console.log(`📦 Pedido #${order.id} criado para ${customerName} - ${paymentMethod}`);
    return order;
}

// Encontrar pedido por ID
function findOrder(orderId) {
    return orders.find(order => order.id === parseInt(orderId));
}

// Obter pedidos pendentes
function getPendingOrders() {
    return orders.filter(order => order.status === 'aguardando_aprovacao');
}

// Obter ebooks ativos
function getActiveEbooks() {
    return ebooks.filter(ebook => ebook.active);
}

// Obter ebook por ID
function getEbookById(ebookId) {
    return ebooks.find(ebook => ebook.id === parseInt(ebookId));
}

// ========== SISTEMA INTELIGENTE DE DETECÇÃO DE COMPROVANTES ==========
function detectPaymentMethod(content) {
    const text = content.trim();
    
    // Detecção M-PESA - mensagem começa com "Confirmado"
    if (text.toLowerCase().startsWith('confirmado')) {
        return {
            method: 'M-PESA',
            valid: true,
            confidence: 'high',
            icon: '📱'
        };
    }
    
    // Detecção E-MOLA - mensagem começa com "ID da transacao" ou "ID da transação"
    if (text.toLowerCase().startsWith('id da transacao') || text.toLowerCase().startsWith('id da transação')) {
        return {
            method: 'E-MOLA',
            valid: true,
            confidence: 'high',
            icon: '💰'
        };
    }
    
    // Detecção por palavras-chave M-PESA
    if (text.toLowerCase().includes('mpesa') || text.toLowerCase().includes('m-pesa')) {
        return {
            method: 'M-PESA',
            valid: true,
            confidence: 'medium',
            icon: '📱'
        };
    }
    
    // Detecção por palavras-chave E-MOLA
    if (text.toLowerCase().includes('emola') || text.toLowerCase().includes('e-mola')) {
        return {
            method: 'E-MOLA',
            valid: true,
            confidence: 'medium',
            icon: '💰'
        };
    }
    
    // Detecção genérica de pagamento
    if (text.toLowerCase().includes('comprovante') || text.toLowerCase().includes('pagamento') || text.toLowerCase().includes('transferencia') || text.toLowerCase().includes('paguei')) {
        return {
            method: 'Aguardando verificação',
            valid: true,
            confidence: 'low',
            icon: '📄'
        };
    }
    
    // Comprovante inválido
    return {
        method: 'Não identificado',
        valid: false,
        confidence: 'none',
        icon: '❓'
    };
}

// Extrair valor do comprovante
function extractAmount(content) {
    const amountMatch = content.match(/(\d+)\s*MZN/) || content.match(/(\d+)\s*meticais/) || content.match(/valor.*?(\d+)/i);
    return amountMatch ? amountMatch[1] + ' MZN' : 'Não identificado';
}

// ========== SISTEMA DE NOTIFICAÇÕES ==========
async function notifyAdmin(message, media = null) {
    try {
        if (media) {
            await client.sendMessage(ADMIN_NUMBER_FORMATTED, media, { caption: message });
        } else {
            await client.sendMessage(ADMIN_NUMBER_FORMATTED, message);
        }
        console.log(`📨 Notificação enviada para admin`);
    } catch (error) {
        console.error('❌ Erro ao notificar admin:', error);
    }
}

// Notificar novo pedido com comprovante DETECTADO
async function notifyNewOrder(order, messageMedia = null, paymentDetection) {
    const methodIcon = paymentDetection.icon;
    const methodName = paymentDetection.method;
    
    let notification = `${methodIcon} *COMPROVANTE ${methodName.toUpperCase()} RECEBIDO* - #${order.id.toString().padStart(3, '0')}

👤 *Cliente:* ${order.customerName}
📞 *Número:* ${order.customerNumber.replace('@c.us', '')}
📚 *Produto:* ${order.ebookName}
💰 *Valor:* ${order.price} MZN
📱 *Método:* ${methodName}
⏰ *Data:* ${new Date(order.createdAt).toLocaleString('pt-BR')}

📋 *COMPROVANTE ORIGINAL:*
"${order.proofContent.substring(0, 100)}${order.proofContent.length > 100 ? '...' : ''}"

⚡ *AÇÕES RÁPIDAS:*
✅ *aprovar ${order.id}* - Aprovar e enviar ebook
❌ *recusar ${order.id}* - Recusar pedido

📊 *Pendentes:* ${getPendingOrders().length} pedidos`;

    await notifyAdmin(notification, messageMedia);
}

// ========== SISTEMA DE RELATÓRIOS AVANÇADO ==========
function getSalesReport() {
    const today = new Date().toDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const todayOrders = orders.filter(order => 
        new Date(order.createdAt).toDateString() === today && 
        order.status === 'aprovado'
    );
    
    const weekOrders = orders.filter(order => 
        new Date(order.createdAt) >= weekAgo && 
        order.status === 'aprovado'
    );
    
    const monthOrders = orders.filter(order => 
        new Date(order.createdAt) >= monthAgo && 
        order.status === 'aprovado'
    );

    const totalSales = orders.filter(o => o.status === 'aprovado').reduce((sum, order) => sum + order.price, 0);
    const todaySales = todayOrders.reduce((sum, order) => sum + order.price, 0);
    const weekSales = weekOrders.reduce((sum, order) => sum + order.price, 0);
    const monthSales = monthOrders.reduce((sum, order) => sum + order.price, 0);

    const mpesaOrders = orders.filter(order => order.paymentMethod === 'M-PESA' && order.status === 'aprovado').length;
    const emolaOrders = orders.filter(order => order.paymentMethod === 'E-MOLA' && order.status === 'aprovado').length;

    // Ebooks mais vendidos
    const ebookSales = {};
    orders.filter(o => o.status === 'aprovado').forEach(order => {
        if (!ebookSales[order.ebookId]) {
            ebookSales[order.ebookId] = { count: 0, revenue: 0, name: order.ebookName };
        }
        ebookSales[order.ebookId].count++;
        ebookSales[order.ebookId].revenue += order.price;
    });

    const topEbooks = Object.entries(ebookSales)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    return {
        totalOrders: orders.length,
        pendingOrders: getPendingOrders().length,
        approvedOrders: orders.filter(o => o.status === 'aprovado').length,
        rejectedOrders: orders.filter(o => o.status === 'recusado').length,
        
        todaySales: todayOrders.length,
        todayRevenue: todaySales,
        weekSales: weekOrders.length,
        weekRevenue: weekSales,
        monthSales: monthOrders.length,
        monthRevenue: monthSales,
        totalRevenue: totalSales,
        
        mpesaCount: mpesaOrders,
        emolaCount: emolaOrders,
        
        conversionRate: orders.length > 0 ? (orders.filter(o => o.status === 'aprovado').length / orders.length * 100).toFixed(1) : 0,
        averageOrderValue: orders.filter(o => o.status === 'aprovado').length > 0 ? 
            (totalSales / orders.filter(o => o.status === 'aprovado').length).toFixed(2) : 0,
        
        topEbooks: topEbooks
    };
}

// Salvar relatório de vendas
function saveSalesReport() {
    try {
        const report = getSalesReport();
        fs.writeFileSync(SALES_FILE, JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar relatório:', error);
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
loadKnownChats();

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "ebook-bot-mz"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    },
    browserWS: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`
});

// ========== SISTEMA QR CODE COM LINK EXTERNO ==========
client.on('qr', (qr) => {
    console.log('\n╔══════════════════════════════╗');
    console.log('║         📱 QR CODE           ║');
    console.log('║     🇲🇿 MOÇAMBIQUE           ║');
    console.log('╚══════════════════════════════╝');
    
    // QR Code compacto no terminal
    qrcode.generate(qr, { small: true });
    
    // Gera link externo para QR Code
    const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
    
    console.log('\n🔗 *QR CODE EXTERNO:*');
    console.log(qrLink);
    console.log('\n📱 *COMO USAR:*');
    console.log('1. Abra o link acima no CELULAR');
    console.log('2. Imagem do QR Code aparecerá');
    console.log('3. Escaneie com WhatsApp');
    console.log('4. Ou use o QR code do terminal acima');
    
    console.log('\n💡 *DICA:* Copie o link e envie por WhatsApp Web para você mesmo');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Bot pronto
client.on('ready', () => {
    console.log('\n╔══════════════════════════════╗');
    console.log('║       ✅ BOT CONECTADO!      ║');
    console.log('╚══════════════════════════════╝');
    const report = getSalesReport();
    console.log(`📚 Ebooks: ${ebooks.length} | 📦 Pedidos: ${report.totalOrders}`);
    console.log(`⏳ Pendentes: ${report.pendingOrders} | ✅ Aprovados: ${report.approvedOrders}`);
    console.log(`📱 M-PESA: ${report.mpesaCount} | 💰 E-mola: ${report.emolaCount}`);
    console.log(`💰 Receita Total: ${report.totalRevenue} MZN`);
    console.log('💻 Sistema: Windows | 📍 Modo: Produção');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ========== FUNÇÕES DE MENSAGENS ==========

// Enviar instruções de compra
async function sendPurchaseInstructions(chat) {
    const activeEbooks = getActiveEbooks();
    
    let instructions = `📚 *CATÁLOGO DE EBOOKS* 📚

`;

    activeEbooks.forEach(ebook => {
        instructions += `${ebook.id}📖 *${ebook.name}* - ${ebook.price} MZN\n`;
    });

    instructions += `
💳 *PAGAMENTO:*
📱 M-PESA: ${CONFIG.PAYMENT_METHODS.MPESA} (Amiro Carlos)
💰 E-mola: ${CONFIG.PAYMENT_METHODS.EMOLA} (Amiro Carlos)

📋 *COMO COMPRAR:*
1. Digite o *NÚMERO* do ebook desejado (ex: 1)
2. Faça o pagamento via M-PESA ou E-mola
3. Envie o comprovante (foto ou texto)
4. Aguarde a aprovação
5. Receba seu ebook automaticamente

📧 *SUPORTE:* ${CONFIG.SUPPORT_EMAIL}
🤖 *CONTATO:* ${CONFIG.BOT_NUMBER}

⚠️ *IMPORTANTE:* Envie comprovantes legíveis`;

    await chat.sendMessage(instructions);
}

// Enviar ebook
async function sendEbook(customerNumber, ebookId) {
    try {
        const ebook = getEbookById(ebookId);
        if (!ebook) {
            throw new Error('Ebook não encontrado');
        }

        let ebookPath = path.join(ebooksDir, ebook.filename);
        
        // Se o arquivo não existir, procurar qualquer PDF na pasta
        if (!fs.existsSync(ebookPath)) {
            const files = fs.readdirSync(ebooksDir);
            const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
            
            if (pdfFiles.length > 0) {
                let correctFilename = pdfFiles[0];
                if (correctFilename.toLowerCase().endsWith('.pdf.pdf')) {
                    correctFilename = correctFilename.replace(/\.pdf\.pdf$/i, '.pdf');
                    const oldPath = path.join(ebooksDir, pdfFiles[0]);
                    const newPath = path.join(ebooksDir, correctFilename);
                    fs.renameSync(oldPath, newPath);
                    console.log(`🔄 Corrigido extensão dupla: ${pdfFiles[0]} → ${correctFilename}`);
                }
                ebookPath = path.join(ebooksDir, correctFilename);
                console.log(`🔍 Usando arquivo alternativo: ${correctFilename}`);
            } else {
                throw new Error('Nenhum arquivo PDF encontrado na pasta ebooks');
            }
        }

        // Renomear arquivo na saída para o nome do ebook
        const safeEbookName = ebook.name
            .replace(/[<>:"/\\|?*]/g, '')
            .substring(0, 100);
        
        const outputFilename = `${safeEbookName}.pdf`;
        
        // Ler o arquivo PDF
        const pdfBuffer = fs.readFileSync(ebookPath);
        
        // Criar Media com nome personalizado
        const ebookMedia = new MessageMedia(
            'application/pdf',
            pdfBuffer.toString('base64'),
            outputFilename
        );

        // Enviar ebook com nome personalizado
        await client.sendMessage(customerNumber, ebookMedia);
        
        // Atualizar contador de vendas do ebook
        ebook.salesCount = (ebook.salesCount || 0) + 1;
        saveEbooks();
        
        // Mensagem de confirmação
        await client.sendMessage(customerNumber, 
            `📖 *EBOOK ENTREGUE!* 📖\n\n*${ebook.name}*\n\nObrigado pela sua compra! 💎\nAproveite a leitura e bons estudos! 🚀\n\n📧 Dúvidas: ${CONFIG.SUPPORT_EMAIL}`);

        console.log(`📤 Ebook "${ebook.name}" enviado como "${outputFilename}"`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar ebook:', error);
        
        // Tentar reenviar uma vez
        try {
            await client.sendMessage(customerNumber, 
                `❌ Erro técnico ao enviar o ebook. Estamos reenviando...\n\n📧 Suporte: ${CONFIG.SUPPORT_EMAIL}`);
            
            const ebook = getEbookById(ebookId);
            let ebookPath = path.join(ebooksDir, ebook.filename);
            
            if (!fs.existsSync(ebookPath)) {
                const files = fs.readdirSync(ebooksDir);
                const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
                if (pdfFiles.length > 0) {
                    let correctFilename = pdfFiles[0];
                    if (correctFilename.toLowerCase().endsWith('.pdf.pdf')) {
                        correctFilename = correctFilename.replace(/\.pdf\.pdf$/i, '.pdf');
                    }
                    ebookPath = path.join(ebooksDir, correctFilename);
                }
            }
            
            const safeEbookName = ebook.name
                .replace(/[<>:"/\\|?*]/g, '')
                .substring(0, 100);
            const outputFilename = `${safeEbookName}.pdf`;
            
            const pdfBuffer = fs.readFileSync(ebookPath);
            const ebookMedia = new MessageMedia(
                'application/pdf',
                pdfBuffer.toString('base64'),
                outputFilename
            );
            
            await client.sendMessage(customerNumber, ebookMedia);
            
            // Atualizar contador de vendas do ebook
            ebook.salesCount = (ebook.salesCount || 0) + 1;
            saveEbooks();
            
            console.log(`📤 Ebook reenviado com sucesso como "${outputFilename}"`);
            return true;
        } catch (retryError) {
            await client.sendMessage(customerNumber, 
                `❌ Problema persistente. Entre em contato com nosso suporte:\n📧 ${CONFIG.SUPPORT_EMAIL}`);
            return false;
        }
    }
}

// Função para corrigir extensões duplicadas nos arquivos existentes
function fixDuplicateExtensions() {
    try {
        if (fs.existsSync(ebooksDir)) {
            const files = fs.readdirSync(ebooksDir);
            let fixedCount = 0;
            
            files.forEach(file => {
                if (file.toLowerCase().endsWith('.pdf.pdf')) {
                    const oldPath = path.join(ebooksDir, file);
                    const newFilename = file.replace(/\.pdf\.pdf$/i, '.pdf');
                    const newPath = path.join(ebooksDir, newFilename);
                    
                    fs.renameSync(oldPath, newPath);
                    console.log(`🔄 Corrigido: ${file} → ${newFilename}`);
                    fixedCount++;
                }
            });
            
            if (fixedCount > 0) {
                console.log(`✅ ${fixedCount} arquivos corrigidos (extensão dupla)`);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao corrigir extensões:', error);
    }
}

// Executar correção na inicialização
fixDuplicateExtensions();

// Enviar informações de suporte
async function sendSupportInfo(chat) {
    const message = `📞 *INFORMAÇÕES DE SUPORTE*

💳 *PAGAMENTO:*
📱 M-PESA: ${CONFIG.PAYMENT_METHODS.MPESA} (Amiro Carlos)
💰 E-mola: ${CONFIG.PAYMENT_METHODS.EMOLA} (Amiro Carlos)

📧 *SUPORTE/DÚVIDAS:*
${CONFIG.SUPPORT_EMAIL}

🤖 *CONTATO:*
${CONFIG.BOT_NUMBER}

💎 *Estamos aqui para ajudar!*`;
    
    await chat.sendMessage(message);
}

// ========== SISTEMA DE SUPORTE INTEGRADO ==========
async function forwardToSupport(message, customerName, customerNumber) {
    const supportMessage = `🆘 *PEDIDO DE SUPORTE*

👤 *Cliente:* ${customerName}
📞 *Número:* ${customerNumber.replace('@c.us', '')}
💬 *Mensagem:* ${message.body.replace('/suporte', '').trim()}

⏰ *Data:* ${new Date().toLocaleString('pt-BR')}`;

    await notifyAdmin(supportMessage);
    await message.reply(`✅ *Sua mensagem foi encaminhada para o suporte!*\n\nEm breve entraremos em contato com você.\n\n📧 ${CONFIG.SUPPORT_EMAIL}`);
}

// Função de ajuda para clientes
async function sendHelpMessage(chat, isUnknownCommand = false) {
    const helpMessage = `🤖 *COMANDOS DISPONÍVEIS*

📚 *CATÁLOGO & COMPRAS:*
• \`menu\` - Ver catálogo de ebooks
• \`1, 2, 3...\` - Selecionar ebook pelo número
• \`status [número]\` - Ver status do pedido

💳 *PAGAMENTO:*
📱 M-PESA: ${CONFIG.PAYMENT_METHODS.MPESA} (Amiro Carlos)
💰 E-mola: ${CONFIG.PAYMENT_METHODS.EMOLA} (Amiro Carlos)

🆘 *SUPORTE:*
• \`suporte\` - Informações de suporte
• \`/suporte "sua mensagem"\` - Falar com atendente

📞 *PRECISA DE AJUDA?*
Envie o comprovante de pagamento ou digite um dos comandos acima.

💡 *DICA:* Envie comprovantes legíveis para aprovação rápida!`;

    if (isUnknownCommand) {
        await chat.sendMessage(`❌ *Comando não reconhecido*\n\n${helpMessage}`);
    } else {
        await chat.sendMessage(helpMessage);
    }
}

// ========== PROCESSAMENTO DE MENSAGENS ==========
client.on('message', async (message) => {
    try {
        if (message.fromMe) return;

        const chat = await message.getChat();
        const messageBody = message.body ? message.body.trim() : '';
        const messageLower = messageBody.toLowerCase();
        const contact = await message.getContact();
        const customerName = contact.name || contact.pushname || 'Cliente';

        console.log(`\n📩 ${customerName}: ${messageBody.substring(0, 30)}...`);

        // DETECÇÃO DE NOVO CHAT 
        const isNewChat = await isFirstInteraction(chat, message);
        if (isNewChat && !chat.isGroup) {
            await sendWelcomeMessage(chat, contact);
            await markChatAsNotNew(chat);
        }

        // Verificar se é grupo permitido ou chat privado
        const isAllowedGroup = chat.isGroup && chat.name === CONFIG.ALLOWED_GROUP;
        const isPrivateChat = !chat.isGroup;
        const isAdminBotChat = isPrivateChat && message.from === ADMIN_NUMBER_FORMATTED;

        // 📱 COMPORTAMENTO PARA CLIENTES
        if ((isAllowedGroup || isPrivateChat) && !isAdminBotChat) {
            
            // Comando suporte com mensagem
            if (messageLower.startsWith('/suporte ')) {
                await forwardToSupport(message, customerName, message.from);
                return;
            }

            // Comando menu
            if (messageLower === 'menu' || messageLower === '!menu' || messageLower === '/menu') {
                await sendPurchaseInstructions(chat);
                return;
            }

            // Comando suporte
            if (messageLower === 'suporte' || messageLower === '!suporte' || messageLower === '/suporte') {
                await sendSupportInfo(chat);
                return;
            }

            // Comando ajuda
            if (messageLower === 'ajuda' || messageLower === 'help' || messageLower === 'comandos' || messageLower === '?') {
                await sendHelpMessage(chat);
                return;
            }

            // Verificar status do pedido
            if (messageLower.startsWith('status') || messageLower.startsWith('/status')) {
                const orderId = messageBody.split(' ')[1];
                if (orderId) {
                    const order = findOrder(orderId);
                    if (order && order.customerNumber === message.from) {
                        let statusMsg = `📋 *STATUS DO PEDIDO #${order.id}*\n\n`;
                        statusMsg += `📚 Produto: ${order.ebookName}\n`;
                        statusMsg += `💎 Valor: ${order.price} MZN\n`;
                        statusMsg += `📱 Método: ${order.paymentMethod}\n`;
                        statusMsg += `📄 Tipo: ${order.proofType}\n`;
                        statusMsg += `⏰ Data: ${new Date(order.createdAt).toLocaleString('pt-BR')}\n\n`;
                        
                        if (order.status === 'aguardando_aprovacao') {
                            statusMsg += `🟡 *Status:* Em análise\n⏳ Aguarde a aprovação`;
                        } else if (order.status === 'aprovado') {
                            statusMsg += `✅ *Status:* Aprovado\n📖 Ebook enviado`;
                        } else if (order.status === 'recusado') {
                            statusMsg += `❌ *Status:* Recusado\n📧 Contate: ${CONFIG.SUPPORT_EMAIL}`;
                        }
                        
                        await message.reply(statusMsg);
                    } else {
                        await message.reply(`❌ Pedido #${orderId} não encontrado.\n📧 Suporte: ${CONFIG.SUPPORT_EMAIL}`);
                    }
                } else {
                    await message.reply(`📋 Para verificar status, digite:\n*status [NÚMERO_DO_PEDIDO]*\n\nExemplo: status 1`);
                }
                return;
            }

            // Seleção de ebook por número
            const ebookNumber = parseInt(messageBody);
            const activeEbooks = getActiveEbooks();
            const selectedEbook = activeEbooks.find(ebook => ebook.id === ebookNumber);

            if (selectedEbook) {
                await message.reply(`📚 *${selectedEbook.name.toUpperCase()}* - ${selectedEbook.price} MZN

💳 *FAÇA O PAGAMENTO:*
📱 M-PESA: ${CONFIG.PAYMENT_METHODS.MPESA} (Amiro Carlos)
💰 E-mola: ${CONFIG.PAYMENT_METHODS.EMOLA} (Amiro Carlos)

💎 *VALOR:* ${selectedEbook.price} MZN

📋 *PRÓXIMO PASSO:*
Envie o *COMPROVANTE* de pagamento (foto ou texto) para finalizar a compra.

⚠️ *Lembrete:* Envie comprovantes legíveis`);
                
                // Armazenar seleção temporária
                message.selectedEbookId = selectedEbook.id;
                return;
            }

            // Processar comprovante (imagem ou texto) - SISTEMA INTELIGENTE
            const hasMedia = message.hasMedia;
            const paymentDetection = detectPaymentMethod(messageBody);
            const isProof = hasMedia || paymentDetection.valid;
            const selectedEbookId = message.selectedEbookId || (activeEbooks.length > 0 ? activeEbooks[0].id : 1);

            if (isProof) {
                let proofContent = messageBody;
                let messageMedia = null;

                if (hasMedia) {
                    const media = await message.downloadMedia();
                    messageMedia = media;
                    proofContent = '[IMAGEM] Comprovante enviado';
                    paymentDetection.method = 'Aguardando verificação (Imagem)';
                    paymentDetection.icon = '📄';
                }

                // Validar comprovante
                if (!paymentDetection.valid && !hasMedia) {
                    await message.reply(`❌ *COMPROVANTE INVÁLIDO*

⚠️ Envie um comprovante legível que contenha:
• "Confirmado" (M-PESA)
• "ID da transação" (E-mola)  
• Ou imagem do comprovante

📧 Dúvidas: ${CONFIG.SUPPORT_EMAIL}`);
                    return;
                }

                const ebook = getEbookById(selectedEbookId);
                const order = createOrder(message.from, customerName, 
                    hasMedia ? 'imagem' : 'texto', selectedEbookId, proofContent, paymentDetection.method);

                // ✅ RESPOSTA INTELIGENTE PARA CLIENTE
                let clientResponse = `✅ *COMPROVANTE RECEBIDO!*\n\n`;
                
                if (paymentDetection.method === 'M-PESA') {
                    clientResponse += `📱 *Detectamos pagamento via M-PESA*\n⏳ Processando sua transação...\n📖 Seu ebook será enviado em instantes!`;
                } else if (paymentDetection.method === 'E-MOLA') {
                    clientResponse += `💰 *Detectamos pagamento via E-MOLA*\n⏳ Processando sua transação...\n📖 Seu ebook será enviado em instantes!`;
                } else if (hasMedia) {
                    clientResponse += `📄 *Comprovante em imagem recebido*\n⏳ Aguarde a verificação manual...\n📖 Seu ebook será enviado após aprovação!`;
                } else {
                    clientResponse += `📋 *Comprovante recebido*\n⏳ Aguarde a verificação...\n📖 Seu ebook será enviado após aprovação!`;
                }

                clientResponse += `\n\n📋 *Pedido #${order.id} registrado*
👤 Cliente: ${customerName}
📚 Produto: ${ebook.name}
💎 Valor: ${ebook.price} MZN
⏰ Data: ${new Date().toLocaleString('pt-BR')}

📧 Suporte: ${CONFIG.SUPPORT_EMAIL}`;

                await message.reply(clientResponse);

                // Notificar admin com detecção inteligente
                await notifyNewOrder(order, messageMedia, paymentDetection);

                return;
            }

            // Comando não reconhecido - mostrar ajuda inteligente
            if (messageBody && !messageLower.startsWith('!') && !messageLower.startsWith('/')) {
                // Verifica se não é número de ebook nem comprovante
                const ebookNumber = parseInt(messageBody);
                const activeEbooks = getActiveEbooks();
                const isEbookNumber = activeEbooks.find(ebook => ebook.id === ebookNumber);
                const paymentDetection = detectPaymentMethod(messageBody);
                const hasMedia = message.hasMedia;
                
                // Só mostra ajuda se realmente for comando desconhecido
                if (!isEbookNumber && !paymentDetection.valid && !hasMedia) {
                    await sendHelpMessage(chat, true);
                }
            }
        }

        // 👨‍💼 COMPORTAMENTO PARA ADMIN
        if (isAdminBotChat) {
            // ... (TODO O SEU CÓDIGO ADMIN AQUI - MANTENHA IGUAL) ...
            
            // Comando não reconhecido para admin
            if (messageBody.startsWith('!') || messageBody.startsWith('/')) {
                await message.reply(`❌ Comando não reconhecido.\nUse /help para ver todos os comandos.`);
            }
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        
        // Tentar enviar mensagem de erro genérica
        try {
            if (!message.fromMe) {
                await message.reply(`❌ Ocorreu um erro interno. Tente novamente.\n📧 Suporte: ${CONFIG.SUPPORT_EMAIL}`);
            }
        } catch (e) {
            console.error('❌ Erro ao enviar mensagem de erro:', e);
        }
    }
});

// ========== SISTEMA DE LOGS ADMIN ==========
function loadLogs() {
    try {
        if (fs.existsSync(LOGS_FILE)) {
            const data = fs.readFileSync(LOGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar logs:', error);
    }
    return [];
}

function saveLog(action, details) {
    try {
        const logs = loadLogs();
        const logEntry = {
            timestamp: new Date().toISOString(),
            admin: CONFIG.ADMIN_NUMBER,
            action: action,
            details: details
        };
        
        logs.push(logEntry);
        
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
        console.log(`📝 Log registrado: ${action}`);
    } catch (error) {
        console.error('❌ Erro ao salvar log:', error);
    }
}

// ========== SISTEMA DE BLOQUEIO DE PEDIDOS ==========
let pendingCustomers = new Set();

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

// ========== FUNÇÃO DE RESET DE PEDIDOS ==========
function resetOrderSystem() {
    const backupData = {
        timestamp: new Date().toISOString(),
        totalOrdersBefore: orders.length,
        pendingOrdersBefore: getPendingOrders().length,
        approvedOrdersBefore: orders.filter(o => o.status === 'aprovado').length,
        rejectedOrdersBefore: orders.filter(o => o.status === 'recusado').length
    };
    
    const backupFile = path.join(dataDir, `backup_orders_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(orders, null, 2));
    
    orders = [];
    orderCounter = 1;
    saveOrders();
    
    saveLog('RESET_SYSTEM', {
        backupFile: path.basename(backupFile),
        ...backupData,
        totalOrdersAfter: 0,
        pendingOrdersAfter: 0
    });
    
    return backupData;
}

// ========== FUNÇÃO DE ESTATÍSTICAS DE LOGS ==========
function getLogStats() {
    const logs = loadLogs();
    const resetLogs = logs.filter(log => log.action === 'RESET_SYSTEM');
    
    return {
        totalLogs: logs.length,
        totalResets: resetLogs.length,
        lastReset: resetLogs.length > 0 ? resetLogs[resetLogs.length - 1].timestamp : 'Nunca',
        recentActions: logs.slice(-5).map(log => ({
            action: log.action,
            timestamp: log.timestamp,
            details: log.details
        }))
    };
}

// ========== TRATAMENTO DE ERROS ==========
client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', async (reason) => {
    console.log('❌ Desconectado:', reason);
    console.log('🔄 Reiniciando em 30 segundos...');
    
    // 🔄 RESETA o contador para permitir novas tentativas
    initializationAttempts = 0; 
    
    // ⏰ Espera 30 segundos ANTES de tentar reconectar
    setTimeout(() => {
        initializeBot();
    }, 30000);
});

// Salvar relatório periodicamente
setInterval(() => {
    saveSalesReport();
}, 300000); // A cada 5 minutos

// DEBUG para Render
console.log('🚀 Iniciando bot no Render...');
console.log('📁 Diretório:', __dirname);
console.log('🔧 Node version:', process.version);

client.on('loading_screen', (percent, message) => {
    console.log(`🔄 LOADING: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
    console.log('✅ AUTHENTICATED: Bot autenticado!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ AUTH FAILED:', msg);
});


// ========== INICIALIZAÇÃO ROBUSTA ==========
let initializationAttempts = 0;        // Contador de tentativas
const MAX_ATTEMPTS = 3;               // Máximo de 3 tentativas

async function initializeBot() {
    // ⛔ PARA se já tentou muitas vezes
    if (initializationAttempts >= MAX_ATTEMPTS) {
        console.log('🚨 Máximo de tentativas atingido. Serviço precisa ser reiniciado.');
        return;
    }

    initializationAttempts++;          // ➕ Incrementa contador
    console.log(`🔄 Tentativa de inicialização ${initializationAttempts}/${MAX_ATTEMPTS}`);

    try {
        // 🚀 TENTA inicializar o bot
        await client.initialize();
        console.log('✅ Bot inicializado com sucesso!');
    } catch (error) {
        // ❌ SE FALHAR, tenta novamente depois de um tempo
        console.error('❌ Erro na inicialização:', error.message);
        
        if (initializationAttempts < MAX_ATTEMPTS) {
            console.log(`⏳ Tentando novamente em 20 segundos...`);
            setTimeout(initializeBot, 20000); // ⏰ Espera 20 segundos
        }
    }
}

// ⏰ Delay inicial para o sistema estabilizar
setTimeout(() => {
    initializeBot();
}, 5000); // Espera 5 segundos antes da PRIMEIRA tentativa


// ========== SERVIDOR HTTP PARA O RENDER ==========
const http = require('http');

// Cria servidor HTTP simples
const server = http.createServer((req, res) => {
    if (req.url === '/status' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            bot: 'WhatsApp Ebook Bot',
            timestamp: new Date().toISOString(),
            ebooks: ebooks.length,
            pendingOrders: getPendingOrders().length
        }, null, 2));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('🤖 Bot Online - Use /status para informações\n');
    }
});
// Usa a porta do Render ou 3000 como fallback
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor HTTP rodando na porta ${PORT}`);
    console.log('🌐 Render vai manter o serviço ativo');
    console.log('🔗 Health check disponível na porta ' + PORT);
});


// Graceful shutdown para Windows
process.on('SIGINT', async () => {
    console.log('\n🔄 Encerrando bot...');
    saveSalesReport();
    await client.destroy();
    console.log('✅ Bot encerrado com sucesso!');
    process.exit(0);
});















