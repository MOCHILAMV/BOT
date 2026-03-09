require('dotenv').config();
const mineflayer = require('mineflayer');
const readline = require('readline');
const { MacroEngine } = require('./macros-engine');

const engine = new MacroEngine();

const OPT = {
    host: process.env.IP,
    port: parseInt(process.env.PORT),
    username: process.env.NAME,
    version: process.env.VERSION,
    checkTimeoutInterval: 45000
};

const PASSWORD = process.env.PASSWORD;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let bot = null;
let isConnected = false;
let isReady = false;
let reconnectTimer = null;
let watchdogInterval = null;

const rl = readline.createInterface({
    input: process.stdin, output: process.stdout, prompt: '> '
});

const log = (msg) => {
    if (rl.closed) return;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`${msg}\n`);
    rl.prompt(true);
};

function safeRestart(delay = 5000) {
    if (reconnectTimer) return;
    isConnected = false;
    isReady = false;
    if (bot) { try { bot.quit(); } catch(e) {} bot = null; }
    if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
    log(`Reiniciando em ${delay / 1000}s...`);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; startBot(); }, delay);
}

function startBot() {
    if (bot) return;
    bot = mineflayer.createBot(OPT);

    bot.once('spawn', async () => {
        bot.physicsEnabled = false;
        isConnected = true;
        await sleep(500);
        isReady = true;

        bot.on('message', (jsonMsg) => {
            const msg = jsonMsg.toAnsi();
            if (msg.trim().length === 0) return;
            log(`${msg}`);
        });

        if (PASSWORD) {
            await sleep(50);
            bot.chat(`/login ${PASSWORD}`);
        }

        log('BOT PRONTO.');

        let last = Date.now();
        watchdogInterval = setInterval(() => {
            const now = Date.now();
            if (now - last - 1000 > 2000) safeRestart(2000);
            last = now;
        }, 1000);
    });

    bot.on('error', (err) => log(`Erro: ${err.message}`));
    bot.on('end', (reason) => { log(`Fim: ${reason}`); safeRestart(); });
}

async function handleMacroCommand(parts) {
    const sub = parts[1];

    if (sub === 'add') {
        const name = parts[2];
        const cmd = parts.slice(3).join(' ');
        if (!name || !cmd) { log('USO: macro add <nome> <comando>'); return; }
        engine.add(name, cmd);
        log(`MACRO ADICIONADA: ${name} => ${cmd}`);
        return;
    }

    if (sub === 'del') {
        const name = parts[2];
        if (!name) { log('USO: macro del <nome>'); return; }
        engine.del(name);
        log(`MACRO REMOVIDA: ${name}`);
        return;
    }

    if (sub === 'list') {
        const list = engine.list();
        if (!list || list.length === 0) { log('SEM MACROS'); return; }
        for (const m of list) process.stdout.write(`${m[0]} => ${m[1]}\n`);
        rl.prompt(true);
        return;
    }

    log('USO: macro <add|del|list>');
}

rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();

    if (input === 'q') process.exit(0);
    if (input === 'c') { if (!isConnected) startBot(); return rl.prompt(); }

    if (!bot || !isConnected || !isReady) {
        log('Aguarde o bot estabilizar...');
        return rl.prompt();
    }

    const parts = input.split(/\s+/);

    if (parts[0] === 'macro') {
        await handleMacroCommand(parts);
        rl.prompt();
        return;
    }

    if (input.startsWith('/')) {
        bot.chat(input);
        rl.prompt();
        return;
    }

    const key = parts[0];
    const cmd = engine.resolve(key);

    if (cmd) {
        const final = cmd.startsWith('/') ? cmd : `/${cmd}`;
        bot.chat(final);
        rl.prompt();
        return;
    }

    log('COMANDO DESCONHECIDO');
    rl.prompt();
});

process.on('SIGINT', () => process.exit(0));
startBot();
