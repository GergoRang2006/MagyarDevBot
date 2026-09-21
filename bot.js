const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    PermissionFlagsBits,
    MessageFlags,
    AuditLogEvent,
    Partials
} = require('discord.js');

// ---------- Beállítások ----------
// A token SOHA ne legyen a kódban! Futtatás: node --env-file=.env bot.js
// (.env tartalma: DISCORD_TOKEN=az_uj_token)
const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID || '1550573376693866526'; // ide mennek a review-ra váró posztok
// Ide mennek a jelentett posztok (admin report szoba).
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID || '1550988586998825090';
// Devlog szoba: ide kerül minden napló (belépések, ban, kick, timeout, törölt üzenetek stb.)
const DEVLOG_CHANNEL_ID = process.env.DEVLOG_CHANNEL_ID || '1551149810797641859';
// Üdvözlő szoba: ide köszönti a bot az új tagokat
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || '1549459709587890258';
// Opcionális: a saját Discord felhasználói ID-d. A /clear-t a szerver tulajdonosa és ez az ID használhatja.
const OWNER_ID = process.env.OWNER_ID || '';
// A /post-hoz ez a rang kell. Ha a VERIFIED_ROLE_ID üres, a "Verified" nevű rangot keresi (kis/nagybetű mindegy).
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID || '';
const VERIFIED_ROLE_NAME = 'verified';
// Ezt a nevet írja ki a bot a kirúgott/kitiltott tagoknak, ha fellebbezni szeretnének
const APPEAL_CONTACT = 'Gerytwt';
// Opcionális: moderátor rang ID-ja. Aki ezt a rangot viseli, a /mod panelen mindent használhat.
// Ha üres, a Discord jogok döntenek (Ban Members, Kick Members, Moderate Members).
const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '';

// ---------- Kinézet ----------
const EMBED_COLOR = 0xFF0000; // az embed bal oldali sávjának színe (piros)
// Ennyi láthatatlan karakter kerül a leírás alá, hogy az embed szélesebb/magasabb legyen.
// Ha nem kell, állítsd 0-ra.
const EMBED_WIDTH_PADDING = 60;
const WIDE_PAD = EMBED_WIDTH_PADDING > 0 ? '\n' + '\u2800'.repeat(EMBED_WIDTH_PADDING) : '';

if (!TOKEN) {
    console.error('Hiányzik a DISCORD_TOKEN környezeti változó!');
    process.exit(1);
}

// ---------- Egyetlen példány védelem ----------
// Ha már fut egy bot ezen a gépen, a második nem indul el (így nem posztol duplán/triplán).
const fs = require('fs');
const os = require('os');
const path = require('path');
const LOCK_FILE = path.join(os.tmpdir(), 'magyardevbot.lock');

function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === 'EPERM';
    }
}

try {
    if (fs.existsSync(LOCK_FILE)) {
        const oldPid = Number(fs.readFileSync(LOCK_FILE, 'utf8'));
        if (oldPid && oldPid !== process.pid && isProcessRunning(oldPid)) {
            console.error(`Már fut egy bot példány (PID: ${oldPid}). Állítsd le, mielőtt újat indítasz!`);
            console.error('Windowson mindent leállít ez a parancs: taskkill /F /IM node.exe');
            process.exit(1);
        }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
} catch (e) {
    console.warn('A példányzár nem hozható létre:', e.message);
}

function releaseLock() {
    try {
        if (fs.readFileSync(LOCK_FILE, 'utf8') === String(process.pid)) fs.unlinkSync(LOCK_FILE);
    } catch {}
}
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// ---------- Kategóriák és csatornák ----------
// Az id: '' helyére másold be az adott csatorna azonosítóját (idézőjelek közé),
// pl. id: '123456789012345678'. Ahol üres az id, oda a bot nem enged posztolni.
const CATEGORIES = {
    hiring: {
        label: 'Hiring',
        selectLabel: 'Hiring – Munkatársat keresek',
        selectDescription: 'Munkát kínálsz, embert keresel hozzá.',
        channels: [
            { name: 'modeller-hiring', description: 'Modellezés külső 3D szoftverrel.', id: '1550227334219571250' },
            { name: 'scripter-hiring', description: 'Roblox scriptelési munkák.', id: '1550507124147228772' },
            { name: 'builder-hiring', description: 'Építés a Roblox Studioban.', id: '1550507159660535909' },
            { name: 'graphics-hiring', description: 'Grafikai tervezés külső szoftverrel.', id: '1550507213083377776' },
            { name: 'programmer-hiring', description: 'Általános programozási munkák.', id: '1550507246260060313' },
            { name: 'animator-hiring', description: 'Roblox animációs munkák.', id: '1550507269165293730' },
            { name: 'clothing-hiring', description: 'Ruhák és kiegészítők tervezése.', id: '1550507296356831472' },
            { name: 'interface-hiring', description: 'Felhasználói felület (UI) tervezése.', id: '1550507325188472853' },
            { name: 'vfx-hiring', description: 'Vizuális effektek (VFX) készítése.', id: '1550507350735978667' },
            { name: 'video-editor-hiring', description: 'Videóvágás és videószerkesztés.', id: '1550946435275427901' }
        ]
    },
    forhire: {
        label: 'For hire',
        selectLabel: 'For hire – Munkát vállalok',
        selectDescription: 'Vállalkozol, és munkát keresel.',
        channels: [
            { name: 'modeller-hireable', description: 'Modellezés külső 3D szoftverrel.', id: '1550227298739949668' },
            { name: 'scripter-hireable', description: 'Roblox scriptelési munkák.', id: '1550505956071317615' },
            { name: 'builder-hireable', description: 'Építés a Roblox Studioban.', id: '1550506329230020698' },
            { name: 'graphics-hireable', description: 'Grafikai tervezés külső szoftverrel.', id: '1550506343402836008' },
            { name: 'programmer-hireable', description: 'Általános programozási munkák.', id: '1550506355763322981' },
            { name: 'animator-hireable', description: 'Roblox animációs munkák.', id: '1550506428911984711' },
            { name: 'clothing-hireable', description: 'Ruhák és kiegészítők tervezése.', id: '1550506445022175373' },
            { name: 'interface-hireable', description: 'Felhasználói felület (UI) tervezése.', id: '1550506458695733248' },
            { name: 'vfx-hireable', description: 'Vizuális effektek (VFX) készítése.', id: '1550506511003029514' },
            { name: 'video-editor-hireable', description: 'Videóvágás és videószerkesztés.', id: '1550946480083308706' }
        ]
    }
};

const SCHEDULES = {
    upfront: { label: 'Előre fizetés', description: 'Előre fizetett díj.' },
    partial: { label: 'Részleges előleg', description: 'Részleges előre fizetés.' },
    completion: { label: 'Teljesítéskor', description: 'Egyszeri fizetés.' },
    pertask: { label: 'Feladatonként', description: 'Feladatonkénti fizetés.' },
    hourly: { label: 'Óránként', description: 'Órabéres fizetés.' },
    weekly: { label: 'Hetente', description: 'Heti fizetés.' },
    monthly: { label: 'Havonta', description: 'Havi fizetés.' }
};

const FIELD_CATEGORY = 'Kategória';
const FIELD_CHANNEL = 'Csatorna';

// A csillagos reakcióhoz üzenetet és üzenettartalmat (mellékleteket) is olvasni kell.
// FIGYELEM: a Message Content Intent-et be kell kapcsolni a Developer Portalon (Bot -> Privileged Gateway Intents)!
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        // FIGYELEM: a Server Members Intent-et is be kell kapcsolni a Developer Portalon (belépő/kilépő tagokhoz)
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration, // audit log események (ban/kick/timeout naplózás)
        GatewayIntentBits.GuildMessageReactions // /rank reakciók
    ],
    // Kell ahhoz, hogy a bot újraindítás után is lássa a régi rangválasztó üzenetekre adott reakciókat
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Ebben a szobában minden képre kap egy csillag reakciót a bot
const STAR_CHANNEL_ID = '1550225744209117254';
const STAR_EMOJI = '⭐';

// Piszkozatok / beküldött posztok (a bot újraindításakor törlődnek)
const drafts = new Map();

// ---------- Segédfüggvények ----------
function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isComplete(d) {
    return Boolean(
        d.title && d.desc && d.channelIdx !== null && d.contacts.length > 0 && d.schedule && d.payments
    );
}

function buildPreviewEmbed(d) {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setAuthor({ name: d.username, iconURL: d.avatar })
        .setTitle(d.title || '<Cím nélküli poszt>')
        .setDescription((d.desc || '<Nincs leírás megadva>') + WIDE_PAD);

    const payParts = [];
    if (d.schedule) payParts.push(`**${SCHEDULES[d.schedule].label}**`);
    if (d.payments) payParts.push(d.payments);

    const contactText = d.contacts.map(c => (c === 'discord' ? `Discord: <@${d.userId}>` : c)).join('\n');

    embed.addFields(
        { name: 'Fizetés', value: payParts.length ? payParts.join('\n') : '*Nincs megadva*' },
        { name: 'Elérhetőség', value: contactText || '*Nincs megadva*' }
    );

    if (d.image) embed.setImage(d.image);
    if (d.thumbnail) embed.setThumbnail(d.thumbnail);

    embed.setFooter({ text: `Poszt ID: (${d.id}) • ${d.status}` });
    return embed;
}

// ---------- Felületek (üzenetek) ----------
function renderMainMenu() {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('edit_repost')
            .setLabel('Szerkesztés/Újraposztolás')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('create_new_post')
            .setLabel('Új poszt létrehozása')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        content: 'Válaszd ki, mit szeretnél: hozz létre egy új posztot, vagy szerkessz egy korábbit.',
        embeds: [],
        components: [row]
    };
}

function backRow(customId = 'back') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(customId).setLabel('Vissza').setStyle(ButtonStyle.Secondary)
    );
}

function renderCategoryPicker() {
    const select = new StringSelectMenuBuilder()
        .setCustomId('category_select')
        .setPlaceholder('Válassz kategóriát')
        .addOptions(
            Object.entries(CATEGORIES).map(([key, cat]) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(cat.selectLabel)
                    .setDescription(cat.selectDescription)
                    .setValue(key)
            )
        );

    return {
        content: 'Válaszd ki a poszt kategóriáját:',
        embeds: [],
        components: [new ActionRowBuilder().addComponents(select), backRow()]
    };
}

function renderEditor(d, notice = '') {
    const cat = CATEGORIES[d.category];
    const infoMissing = (d.title ? 0 : 1) + (d.desc ? 0 : 1);

    const infoBtn = new ButtonBuilder()
        .setCustomId(`edit_info:${d.id}`)
        .setLabel(infoMissing ? `* Poszt adatainak szerkesztése (${infoMissing} kötelező)` : 'Poszt adatainak szerkesztése')
        .setStyle(infoMissing ? ButtonStyle.Danger : ButtonStyle.Secondary);

    const payBtn = new ButtonBuilder()
        .setCustomId(`edit_pay:${d.id}`)
        .setLabel(d.payments ? 'Fizetési típusok szerkesztése' : '* Fizetési típusok szerkesztése (legalább 1 kötelező)')
        .setStyle(d.payments ? ButtonStyle.Secondary : ButtonStyle.Danger);

    const channelSelect = new StringSelectMenuBuilder()
        .setCustomId(`sel_channel:${d.id}`)
        .setPlaceholder('* Válassz csatornát')
        .addOptions(
            cat.channels.map((c, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(c.name)
                    .setDescription(c.description)
                    .setValue(String(i))
                    .setDefault(d.channelIdx === i)
            )
        );

    const contactSelect = new StringSelectMenuBuilder()
        .setCustomId(`sel_contact:${d.id}`)
        .setPlaceholder('* Válassz egy vagy több elérhetőséget')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(d.username)
                .setDescription('Discord privát üzenet')
                .setValue('discord')
                .setDefault(d.contacts.includes('discord'))
        );

    const scheduleSelect = new StringSelectMenuBuilder()
        .setCustomId(`sel_pay:${d.id}`)
        .setPlaceholder('* Válassz fizetési ütemezést')
        .addOptions(
            Object.entries(SCHEDULES).map(([key, s]) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(s.label)
                    .setDescription(s.description)
                    .setValue(key)
                    .setDefault(d.schedule === key)
            )
        );

    const bottomRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`submit:${d.id}`)
            .setLabel('Beküldés jóváhagyásra')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!isComplete(d)),
        new ButtonBuilder().setCustomId('back').setLabel('Vissza').setStyle(ButtonStyle.Secondary)
    );

    const content = [
        ...(notice ? [notice, ''] : []),
        'Itt látod a posztod előnézetét. Az alábbi szerkesztővel módosíthatod, hogyan fog kinézni.',
        'A módosítások automatikusan mentődnek. Ha később folytatnád, futtasd a `/post` parancsot, és válaszd a „Szerkesztés/Újraposztolás” gombot.',
        '',
        'Amíg a kötelező (*) mezők nincsenek kitöltve, nem küldheted be jóváhagyásra.',
        `Kategória: **${cat.label}**`
    ].join('\n');

    return {
        content,
        embeds: [buildPreviewEmbed(d)],
        components: [
            new ActionRowBuilder().addComponents(infoBtn, payBtn),
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(contactSelect),
            new ActionRowBuilder().addComponents(scheduleSelect),
            bottomRow
        ]
    };
}

async function getOwnDraft(interaction, id) {
    const draft = drafts.get(id);
    if (!draft || draft.userId !== interaction.user.id) {
        await interaction.reply({
            content: 'Ez a piszkozat már nem elérhető (lehet, hogy a bot újraindult). Használd újra a `/post` parancsot.',
            flags: MessageFlags.Ephemeral
        });
        return null;
    }
    return draft;
}

// ---------- Indulás + parancs regisztrálás ----------
client.once(Events.ClientReady, async () => {
    console.log(`Bejelentkezve mint ${client.user.tag}! (PID: ${process.pid})`);

    for (const cat of Object.values(CATEGORIES)) {
        for (const ch of cat.channels) {
            if (!ch.id) console.warn(`Figyelem: nincs beállítva azonosító ehhez a csatornához: ${ch.name}`);
        }
    }

    const commands = [
        new SlashCommandBuilder()
            .setName('post')
            .setDescription('Új poszt létrehozása vagy szerkesztése')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('A csatorna ÖSSZES üzenetének törlése (csak a tulajdonos)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('mod')
            .setDescription('Moderációs panel (ban, kick, mute, unban, unmute)')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('rank')
            .setDescription('Rangválasztó üzenet küldése (reakcióval kapható rangok)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addStringOption(o => o
                .setName('text')
                .setDescription('A kiírandó szöveg (új sor: \\n)')
                .setRequired(true)
                .setMaxLength(1500))
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash parancs regisztrálva!');
    } catch (error) {
        console.error('Parancs regisztrálási hiba:', error);
    }

    // Lejárt ideiglenes tiltások feloldása (induláskor, majd percenként)
    processTempBans().catch(e => console.error('Tempban hiba:', e));
    setInterval(() => processTempBans().catch(e => console.error('Tempban hiba:', e)), 60 * 1000);
});

// ---------- Csillag reakció a képekre ----------
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif)(\?|$)/i;
const IMAGE_URL_IN_TEXT = /https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|avif)(\?\S*)?/i;

function messageHasImage(message) {
    // Feltöltött képek
    const hasAttachment = message.attachments.some(a =>
        (a.contentType && a.contentType.startsWith('image/')) || IMAGE_EXT.test(a.name ?? a.url)
    );
    if (hasAttachment) return true;

    // Beágyazott képek (embed)
    const hasEmbedImage = message.embeds.some(e => e.image || e.thumbnail || e.type === 'image');
    if (hasEmbedImage) return true;

    // Képre mutató link az üzenet szövegében
    return IMAGE_URL_IN_TEXT.test(message.content ?? '');
}

client.on(Events.MessageCreate, async message => {
    try {
        if (message.author.bot) return;
        if (message.channelId !== STAR_CHANNEL_ID) return;
        if (!messageHasImage(message)) return;

        await message.react(STAR_EMOJI);
    } catch (error) {
        console.error('Csillag reakció hiba:', error);
    }
});

// ---------- /clear: a csatorna teljes kiürítése ----------
const clearing = new Set(); // melyik csatornákat ürítjük épp
// A 14 napnál régebbi üzenetek nem törölhetők tömegesen, azokat egyesével kell (lassabb).
const BULK_LIMIT_MS = 13 * 24 * 60 * 60 * 1000;

function canClear(interaction) {
    return Boolean(
        interaction.guild &&
        (interaction.guild.ownerId === interaction.user.id ||
            (OWNER_ID && interaction.user.id === OWNER_ID))
    );
}

async function clearChannel(channel, onProgress) {
    let deleted = 0;
    let lastReport = 0;

    while (true) {
        const batch = await channel.messages.fetch({ limit: 100 });
        if (batch.size === 0) break;

        const recent = batch.filter(m => Date.now() - m.createdTimestamp < BULK_LIMIT_MS);
        const old = batch.filter(m => !recent.has(m.id));
        let deletedThisRound = 0;

        if (recent.size >= 2) {
            const res = await channel.bulkDelete(recent, true).catch(() => null);
            deletedThisRound += res ? res.size : 0;
        } else if (recent.size === 1) {
            const ok = await recent.first().delete().then(() => true).catch(() => false);
            if (ok) deletedThisRound += 1;
        }

        for (const m of old.values()) {
            const ok = await m.delete().then(() => true).catch(() => false);
            if (ok) deletedThisRound += 1;
        }

        if (deletedThisRound === 0) break; // már semmi sem törölhető
        deleted += deletedThisRound;

        if (onProgress && Date.now() - lastReport > 5000) {
            lastReport = Date.now();
            await onProgress(deleted).catch(() => {});
        }
    }

    return deleted;
}

async function handleClearCommand(interaction) {
    if (!interaction.inGuild() || !interaction.channel) {
        await interaction.reply({ content: 'Ez a parancs csak szerveren használható.', flags: MessageFlags.Ephemeral });
        return;
    }

    if (!canClear(interaction)) {
        await interaction.reply({
            content: 'Ezt a parancsot csak a szerver tulajdonosa használhatja.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const needed = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
    ];
    if (interaction.appPermissions && !interaction.appPermissions.has(needed)) {
        await interaction.reply({
            content: 'A botnak ebben a csatornában kell a **Manage Messages** (Üzenetek kezelése) és a **Read Message History** jog.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`clear_confirm:${interaction.channelId}:${interaction.user.id}`)
            .setLabel('Igen, mindent törlök')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('clear_cancel')
            .setLabel('Mégsem')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        content:
            `⚠️ **Ez a(z) <#${interaction.channelId}> csatorna MINDEN üzenetét véglegesen törli** ` +
            '(szövegek, képek, fájlok, botüzenetek, minden). Ez nem visszavonható. Biztosan folytatod?',
        components: [row],
        flags: MessageFlags.Ephemeral
    });
}

// ---------- Moderáció: devlog, /ban, /kick, üdvözlő ----------
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const unix = ms => Math.floor(ms / 1000);
const fullTime = ms => `<t:${unix(ms)}:F> (<t:${unix(ms)}:R>)`;
const userLine = id => (id ? `<@${id}> (\`${id}\`)` : '*Ismeretlen*');
const shorten = (text, max = 1000) => (text.length > max ? text.slice(0, max - 1) + '…' : text);

// A devlog embedek oldalsávjának színei
const LOG_COLORS = {
    ban: EMBED_COLOR,
    kick: 0xE67E22,
    join: 0x57F287,
    leave: 0x95A5A6,
    unban: 0x57F287,
    timeout: 0xFEE75C,
    message: 0x5865F2
};

// Minden naplóbejegyzés ezen megy át: egy kis embed a devlog szobába
async function sendDevlog(embed) {
    try {
        const channel = await client.channels.fetch(DEVLOG_CHANNEL_ID);
        await channel.send({ embeds: [embed.setTimestamp()], allowedMentions: { parse: [] } });
    } catch (error) {
        console.error('Devlog hiba:', error.message);
    }
}

// Ban/kick után a tag "kilépését" nem naplózzuk külön (különben dupla lenne a log)
const recentRemovals = new Set();
function markRemoval(userId) {
    recentRemovals.add(userId);
    setTimeout(() => recentRemovals.delete(userId), 15000);
}

// Ha a DM nem ment át, a moderátor ezt látja a válaszban
const dmNote = sent => (sent ? '' : '\n⚠️ A privát üzenetet nem tudtam elküldeni neki (valószínűleg le van tiltva a DM).');
const APPEAL_TEXT = `Ha szerinted tévedés történt, vagy fellebbezni szeretnél, add hozzá Discordon: **${APPEAL_CONTACT}**`;

function isVerified(interaction) {
    const roles = interaction.member?.roles?.cache;
    if (!roles) return false;
    return roles.some(r => (VERIFIED_ROLE_ID ? r.id === VERIFIED_ROLE_ID : r.name.toLowerCase() === VERIFIED_ROLE_NAME));
}

function formatMinutes(m) {
    if (m % 1440 === 0) return `${m / 1440} nap`;
    if (m % 60 === 0) return `${m / 60} óra`;
    return `${m} perc`;
}

async function tryDm(user, embed) {
    try {
        await user.send({ embeds: [embed] });
        return true;
    } catch {
        return false; // le van tiltva a DM
    }
}

// ---------- Ideiglenes tiltások (fájlban tárolva, újraindítás után is megmaradnak) ----------
const TEMPBAN_FILE = path.join(__dirname, 'tempbans.json');
let tempBans = [];
try {
    tempBans = JSON.parse(fs.readFileSync(TEMPBAN_FILE, 'utf8'));
    if (!Array.isArray(tempBans)) tempBans = [];
} catch {
    tempBans = [];
}

function saveTempBans() {
    try {
        fs.writeFileSync(TEMPBAN_FILE, JSON.stringify(tempBans, null, 2));
    } catch (error) {
        console.error('A tempbans.json nem menthető:', error.message);
    }
}

function removeTempBan(guildId, userId) {
    const before = tempBans.length;
    tempBans = tempBans.filter(b => !(b.guildId === guildId && b.userId === userId));
    if (tempBans.length !== before) saveTempBans();
}

let processingTempBans = false;
async function processTempBans() {
    if (processingTempBans) return;
    processingTempBans = true;
    try {
        const due = tempBans.filter(b => b.unbanAt <= Date.now());
        for (const ban of due) {
            try {
                const guild = await client.guilds.fetch(ban.guildId);
                await guild.members.unban(ban.userId, 'Lejárt az ideiglenes tiltás');
            } catch (error) {
                // 10026 = már nincs kitiltva, 10004 = a szerver már nem elérhető -> töröljük a bejegyzést
                if (error.code !== 10026 && error.code !== 10004) {
                    console.error('Automatikus unban hiba:', error.message);
                    continue; // legközelebb újra próbáljuk
                }
            }

            tempBans = tempBans.filter(b => b !== ban);
            saveTempBans();

            await sendDevlog(
                new EmbedBuilder()
                    .setColor(LOG_COLORS.unban)
                    .setTitle('⏰ Ideiglenes tiltás lejárt')
                    .addFields(
                        { name: 'Felhasználó', value: userLine(ban.userId) },
                        { name: 'Feloldva', value: 'Automatikusan (lejárt az idő)' }
                    )
            );
        }
    } finally {
        processingTempBans = false;
    }
}

// ---------- /ban és /kick ----------
// Közös ellenőrzés: magát, a botot, a tulajdonost és a nála magasabb rangút nem lehet.
function checkModerable(interaction, target, member) {
    const guild = interaction.guild;
    if (target.id === interaction.user.id) return 'Magadat nem teheted meg.';
    if (target.id === client.user.id) return 'A botot nem tudod.';
    if (target.id === guild.ownerId) return 'A szerver tulajdonosát nem lehet.';

    const modTop = interaction.member?.roles?.highest;
    if (member && modTop && interaction.user.id !== guild.ownerId &&
        modTop.comparePositionTo(member.roles.highest) <= 0) {
        return 'Ő ugyanolyan vagy magasabb rangú, mint te.';
    }
    return null;
}

// ---------- Jogosultság: csak a tulaj és a modok ----------
function isOwner(interaction) {
    return Boolean(
        interaction.guild &&
        (interaction.user.id === interaction.guild.ownerId || (OWNER_ID && interaction.user.id === OWNER_ID))
    );
}

// A tulaj mindent tud. A MOD_ROLE_ID rang (ha be van állítva) szintén mindent.
// Egyébként az adott művelethez tartozó Discord jog kell (Ban Members, Kick Members, Moderate Members).
function canModerate(interaction, permission) {
    if (isOwner(interaction)) return true;
    if (MOD_ROLE_ID && interaction.member?.roles?.cache?.has(MOD_ROLE_ID)) return true;
    return Boolean(interaction.memberPermissions?.has(permission));
}

function isModerator(interaction) {
    return (
        canModerate(interaction, PermissionFlagsBits.BanMembers) ||
        canModerate(interaction, PermissionFlagsBits.KickMembers) ||
        canModerate(interaction, PermissionFlagsBits.ModerateMembers)
    );
}

// ---------- Felhasználó keresése (ID, @említés vagy felhasználónév) ----------
async function resolveTarget(guild, input) {
    const text = input.trim();
    const idMatch = text.match(/\d{17,20}/);
    if (idMatch) return client.users.fetch(idMatch[0]).catch(() => null);

    const query = text.replace(/^@/, '').toLowerCase();
    if (!query) return null;

    const found = await guild.members.search({ query, limit: 5 }).catch(() => null);
    if (!found || found.size === 0) return null;

    const exact = found.find(
        m => m.user.username.toLowerCase() === query || m.displayName.toLowerCase() === query
    );
    if (exact) return exact.user;
    if (found.size === 1) return found.first().user;
    return null; // több találat, nem tudjuk melyik
}

// Tiltott felhasználó keresése (ID vagy felhasználónév alapján)
async function resolveBanned(guild, input) {
    const text = input.trim();
    const idMatch = text.match(/\d{17,20}/);
    if (idMatch) return guild.bans.fetch(idMatch[0]).catch(() => null);

    const query = text.replace(/^@/, '').toLowerCase();
    if (!query) return null;

    const bans = await guild.bans.fetch().catch(() => null);
    if (!bans) return null;
    return (
        bans.find(
            b => b.user.username.toLowerCase() === query || b.user.globalName?.toLowerCase() === query
        ) ?? null
    );
}

// ---------- Műveletek (a panel űrlapjai hívják őket; a válasz már "deferred") ----------
async function doBan(interaction, { target, reason, type, hours }) {
    const guild = interaction.guild;
    const fail = text => interaction.editReply({ content: `❌ ${text}` });

    if (!canModerate(interaction, PermissionFlagsBits.BanMembers)) {
        await fail('Ehhez **Ban Members** jog kell.');
        return;
    }

    if (await guild.bans.fetch(target.id).catch(() => null)) {
        await fail('Ő már ki van tiltva.');
        return;
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    const problem = checkModerable(interaction, target, member);
    if (problem) {
        await fail(problem);
        return;
    }
    if (member && !member.bannable) {
        await fail('A bot nem tudja kitiltani (a botnál magasabb rangú, vagy hiányzik a Ban Members jog).');
        return;
    }

    const isTemp = type === 'temp';
    const unbanAt = isTemp ? Date.now() + hours * 60 * 60 * 1000 : null;
    const durationText = isTemp ? `${hours} óra` : 'Végleges';

    // A DM-et a ban ELŐTT kell elküldeni, utána már nem érhető el a tag
    let dmSent = true;
    if (member) {
        const dmEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle(`Ki lettél tiltva a(z) ${guild.name} szerverről`)
            .setDescription(
                isTemp
                    ? `Ideiglenesen kitiltottak a(z) **${guild.name}** szerverről.`
                    : `Véglegesen kitiltottak a(z) **${guild.name}** szerverről.`
            )
            .addFields(
                { name: 'Indok', value: shorten(reason) },
                { name: 'Időtartam', value: isTemp ? `${hours} óra (lejár: <t:${unix(unbanAt)}:F>)` : 'Végleges' },
                { name: 'Fellebbezés', value: APPEAL_TEXT }
            );
        dmSent = await tryDm(target, dmEmbed);
    }

    markRemoval(target.id);
    try {
        await guild.members.ban(target.id, {
            reason: shorten(`${reason} | Mod: ${interaction.user.tag} | ${durationText}`, 500)
        });
    } catch (error) {
        console.error('Ban hiba:', error);
        await fail('Nem sikerült kitiltani, nézd meg a bot jogosultságait.');
        return;
    }

    removeTempBan(guild.id, target.id);
    if (isTemp) {
        tempBans.push({ guildId: guild.id, userId: target.id, unbanAt });
        saveTempBans();
    }

    const embed = new EmbedBuilder()
        .setColor(LOG_COLORS.ban)
        .setTitle(isTemp ? '🔨 Ideiglenes tiltás' : '🔨 Végleges tiltás')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Felhasználó', value: userLine(target.id), inline: true },
            { name: 'Moderátor', value: userLine(interaction.user.id), inline: true },
            { name: 'Időtartam', value: durationText, inline: true }
        );
    if (isTemp) embed.addFields({ name: 'Lejár', value: fullTime(unbanAt) });
    embed.addFields({ name: 'Indok', value: shorten(reason) });
    await sendDevlog(embed);

    await interaction.editReply({ content: `✅ **${target.tag}** kitiltva (${durationText}).${dmNote(dmSent)}` });
}

async function doUnban(interaction, { input, reason }) {
    const guild = interaction.guild;
    const fail = text => interaction.editReply({ content: `❌ ${text}` });

    if (!canModerate(interaction, PermissionFlagsBits.BanMembers)) {
        await fail('Ehhez **Ban Members** jog kell.');
        return;
    }

    const ban = await resolveBanned(guild, input);
    if (!ban) {
        await fail('Nem találom a kitiltottak között. Add meg a pontos ID-t vagy felhasználónevet.');
        return;
    }

    try {
        await guild.members.unban(ban.user.id, shorten(`${reason} | Mod: ${interaction.user.tag}`, 500));
    } catch (error) {
        console.error('Unban hiba:', error);
        await fail('Nem sikerült feloldani a tiltást, nézd meg a bot jogosultságait.');
        return;
    }

    removeTempBan(guild.id, ban.user.id);

    await sendDevlog(
        new EmbedBuilder()
            .setColor(LOG_COLORS.unban)
            .setTitle('✅ Tiltás feloldva')
            .setThumbnail(ban.user.displayAvatarURL())
            .addFields(
                { name: 'Felhasználó', value: userLine(ban.user.id), inline: true },
                { name: 'Moderátor', value: userLine(interaction.user.id), inline: true },
                { name: 'Indok', value: shorten(reason) }
            )
    );

    await interaction.editReply({ content: `✅ **${ban.user.tag}** tiltása feloldva.` });
}

async function doKick(interaction, { target, reason }) {
    const guild = interaction.guild;
    const fail = text => interaction.editReply({ content: `❌ ${text}` });

    if (!canModerate(interaction, PermissionFlagsBits.KickMembers)) {
        await fail('Ehhez **Kick Members** jog kell.');
        return;
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        await fail('Ő nincs a szerveren.');
        return;
    }

    const problem = checkModerable(interaction, target, member);
    if (problem) {
        await fail(problem);
        return;
    }
    if (!member.kickable) {
        await fail('A bot nem tudja kirúgni (a botnál magasabb rangú, vagy hiányzik a Kick Members jog).');
        return;
    }

    // A DM-et a kick ELŐTT kell elküldeni
    const dmSent = await tryDm(
        target,
        new EmbedBuilder()
            .setColor(LOG_COLORS.kick)
            .setTitle(`Ki lettél rúgva a(z) ${guild.name} szerverről`)
            .setDescription(`Kirúgtak a(z) **${guild.name}** szerverről. Újra csatlakozhatsz, de viselkedj a szabályok szerint.`)
            .addFields(
                { name: 'Indok', value: shorten(reason) },
                { name: 'Fellebbezés', value: APPEAL_TEXT }
            )
    );

    markRemoval(target.id);
    try {
        await member.kick(shorten(`${reason} | Mod: ${interaction.user.tag}`, 500));
    } catch (error) {
        console.error('Kick hiba:', error);
        await fail('Nem sikerült kirúgni, nézd meg a bot jogosultságait.');
        return;
    }

    await sendDevlog(
        new EmbedBuilder()
            .setColor(LOG_COLORS.kick)
            .setTitle('👢 Kick')
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: 'Felhasználó', value: userLine(target.id), inline: true },
                { name: 'Moderátor', value: userLine(interaction.user.id), inline: true },
                { name: 'Indok', value: shorten(reason) }
            )
    );

    await interaction.editReply({ content: `✅ **${target.tag}** kirúgva.${dmNote(dmSent)}` });
}

async function doMute(interaction, { target, reason, minutes }) {
    const guild = interaction.guild;
    const fail = text => interaction.editReply({ content: `❌ ${text}` });

    if (!canModerate(interaction, PermissionFlagsBits.ModerateMembers)) {
        await fail('Ehhez **Moderate Members** jog kell.');
        return;
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        await fail('Ő nincs a szerveren.');
        return;
    }

    const problem = checkModerable(interaction, target, member);
    if (problem) {
        await fail(problem);
        return;
    }
    if (!member.moderatable) {
        await fail('A bot nem tudja némítani (adminisztrátor, a botnál magasabb rangú, vagy hiányzik a Moderate Members jog).');
        return;
    }

    const until = Date.now() + minutes * 60 * 1000;
    const durationText = formatMinutes(minutes);
    try {
        await member.timeout(minutes * 60 * 1000, shorten(`${reason} | Mod: ${interaction.user.tag} | ${durationText}`, 500));
    } catch (error) {
        console.error('Mute hiba:', error);
        await fail('Nem sikerült némítani, nézd meg a bot jogosultságait.');
        return;
    }

    await sendDevlog(
        new EmbedBuilder()
            .setColor(LOG_COLORS.timeout)
            .setTitle('🔇 Mute')
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: 'Felhasználó', value: userLine(target.id), inline: true },
                { name: 'Moderátor', value: userLine(interaction.user.id), inline: true },
                { name: 'Időtartam', value: durationText, inline: true },
                { name: 'Lejár', value: fullTime(until) },
                { name: 'Indok', value: shorten(reason) }
            )
    );

    await interaction.editReply({ content: `✅ **${target.tag}** némítva (${durationText}).` });
}

async function doUnmute(interaction, { target, reason }) {
    const guild = interaction.guild;
    const fail = text => interaction.editReply({ content: `❌ ${text}` });

    if (!canModerate(interaction, PermissionFlagsBits.ModerateMembers)) {
        await fail('Ehhez **Moderate Members** jog kell.');
        return;
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        await fail('Ő nincs a szerveren.');
        return;
    }
    if (!member.isCommunicationDisabled()) {
        await fail('Ő jelenleg nincs némítva.');
        return;
    }
    if (!member.moderatable) {
        await fail('A bot nem tudja feloldani a némítást (a botnál magasabb rangú, vagy hiányzik a Moderate Members jog).');
        return;
    }

    try {
        await member.timeout(null, shorten(`${reason} | Mod: ${interaction.user.tag}`, 500));
    } catch (error) {
        console.error('Unmute hiba:', error);
        await fail('Nem sikerült feloldani a némítást, nézd meg a bot jogosultságait.');
        return;
    }

    await sendDevlog(
        new EmbedBuilder()
            .setColor(LOG_COLORS.unban)
            .setTitle('🔊 Unmute')
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: 'Felhasználó', value: userLine(target.id), inline: true },
                { name: 'Moderátor', value: userLine(interaction.user.id), inline: true },
                { name: 'Indok', value: shorten(reason) }
            )
    );

    await interaction.editReply({ content: `✅ **${target.tag}** némítása feloldva.` });
}

// ---------- A /mod panel ----------
function renderModPanel() {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('🛡️ Moderációs panel')
        .setDescription(
            'Válassz műveletet, és töltsd ki az űrlapot.\n' +
            'A felhasználót megadhatod **ID-val**, **@említéssel**, vagy (ha a szerveren van) **felhasználónévvel**.\n\n' +
            'ℹ️ Kirúgást nem lehet visszavonni: a kirúgott tag magától újra csatlakozhat, ezért „unkick” nincs.'
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mod:ban_perma').setLabel('Végleges ban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('mod:ban_temp').setLabel('Ideiglenes ban').setEmoji('⏳').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('mod:kick').setLabel('Kick').setEmoji('👢').setStyle(ButtonStyle.Danger)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mod:mute').setLabel('Mute').setEmoji('🔇').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('mod:unmute').setLabel('Unmute').setEmoji('🔊').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('mod:unban').setLabel('Unban').setEmoji('✅').setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [row1, row2] };
}

function modalRow(id, label, { paragraph = false, required = true, max = 100, placeholder = '' } = {}) {
    const input = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setMaxLength(max)
        .setRequired(required);
    if (placeholder) input.setPlaceholder(placeholder);
    return new ActionRowBuilder().addComponents(input);
}

const MOD_MODALS = {
    ban_perma: { title: 'Végleges tiltás', reasonRequired: true, extra: [] },
    ban_temp: {
        title: 'Ideiglenes tiltás',
        reasonRequired: true,
        extra: [modalRow('hours', 'Hány órára?', { max: 5, placeholder: 'pl. 24 (max. 8760)' })]
    },
    kick: { title: 'Kirúgás', reasonRequired: true, extra: [] },
    mute: {
        title: 'Némítás',
        reasonRequired: true,
        extra: [modalRow('minutes', 'Hány percre?', { max: 5, placeholder: 'pl. 60 (max. 40320 = 28 nap)' })]
    },
    unmute: { title: 'Némítás feloldása', reasonRequired: false, extra: [] },
    unban: { title: 'Tiltás feloldása', reasonRequired: false, extra: [] }
};

function buildModModal(action) {
    const cfg = MOD_MODALS[action];
    return new ModalBuilder()
        .setCustomId(`modm:${action}`)
        .setTitle(cfg.title)
        .addComponents(
            modalRow('target', 'Felhasználó (ID / @ / név)', { placeholder: 'ID, @említés vagy felhasználónév' }),
            ...cfg.extra,
            modalRow('reason', cfg.reasonRequired ? 'Indok' : 'Indok (nem kötelező)', {
                paragraph: true,
                required: cfg.reasonRequired,
                max: 400
            })
        );
}

async function handleModCommand(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: 'Ez a parancs csak szerveren használható.', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!isModerator(interaction)) {
        await interaction.reply({
            content: 'Ezt a panelt csak a moderátorok és a szerver tulajdonosa használhatja.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    await interaction.reply({ ...renderModPanel(), flags: MessageFlags.Ephemeral });
}

async function handleModButton(interaction) {
    const action = interaction.customId.split(':')[1];
    if (!MOD_MODALS[action]) return;

    if (!interaction.inGuild() || !isModerator(interaction)) {
        await interaction.reply({
            content: 'Ehhez moderátori jog kell.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    await interaction.showModal(buildModModal(action));
}

function parseWhole(text, min, max) {
    const m = String(text).trim().match(/^\d+/);
    if (!m) return null;
    const n = Number(m[0]);
    return n >= min && n <= max ? n : null;
}

async function handleModModal(interaction) {
    const action = interaction.customId.split(':')[1];
    if (!MOD_MODALS[action]) return;

    // Előbb nyugtázzuk az interakciót (a keresés/ban több mint 3 mp-ig is tarthat)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const fail = text => interaction.editReply({ content: `❌ ${text}` });

    if (!interaction.inGuild() || !interaction.guild) {
        await fail('Ez csak szerveren használható.');
        return;
    }
    if (!isModerator(interaction)) {
        await fail('Ehhez moderátori jog kell.');
        return;
    }

    const get = id => {
        try {
            return interaction.fields.getTextInputValue(id).trim();
        } catch {
            return '';
        }
    };
    const input = get('target');
    const reason = get('reason') || 'Nincs megadva';

    if (action === 'unban') {
        await doUnban(interaction, { input, reason });
        return;
    }

    const target = await resolveTarget(interaction.guild, input);
    if (!target) {
        await fail('Nem találom ezt a felhasználót (vagy több ilyen nevű van). Használd az ID-t vagy az @említést.');
        return;
    }

    if (action === 'ban_perma') {
        await doBan(interaction, { target, reason, type: 'perma', hours: null });
    } else if (action === 'ban_temp') {
        const hours = parseWhole(get('hours'), 1, 24 * 365);
        if (!hours) {
            await fail('Az órák száma 1 és 8760 közötti egész szám legyen.');
            return;
        }
        await doBan(interaction, { target, reason, type: 'temp', hours });
    } else if (action === 'kick') {
        await doKick(interaction, { target, reason });
    } else if (action === 'mute') {
        const minutes = parseWhole(get('minutes'), 1, 28 * 24 * 60);
        if (!minutes) {
            await fail('A percek száma 1 és 40320 közötti egész szám legyen.');
            return;
        }
        await doMute(interaction, { target, reason, minutes });
    } else if (action === 'unmute') {
        await doUnmute(interaction, { target, reason });
    }
}

// ---------- Devlog: amit a modok kézzel csinálnak (Discord felületről) ----------
// A Discord audit log eseményeiből dolgozik. A bot saját műveleteit (/ban, /kick) kihagyja,
// mert azokat a parancs már naplózta.
client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    try {
        const { action, executorId, targetId } = entry;

        if (action === AuditLogEvent.MemberKick || action === AuditLogEvent.MemberBanAdd) {
            markRemoval(targetId);
        }
        if (executorId === client.user.id) return;

        const reason = entry.reason ? shorten(entry.reason) : '*Nincs megadva*';

        if (action === AuditLogEvent.MemberKick) {
            await sendDevlog(
                new EmbedBuilder()
                    .setColor(LOG_COLORS.kick)
                    .setTitle('👢 Kick')
                    .addFields(
                        { name: 'Felhasználó', value: userLine(targetId), inline: true },
                        { name: 'Moderátor', value: userLine(executorId), inline: true },
                        { name: 'Indok', value: reason }
                    )
            );
        } else if (action === AuditLogEvent.MemberBanAdd) {
            await sendDevlog(
                new EmbedBuilder()
                    .setColor(LOG_COLORS.ban)
                    .setTitle('🔨 Tiltás (kézzel)')
                    .addFields(
                        { name: 'Felhasználó', value: userLine(targetId), inline: true },
                        { name: 'Moderátor', value: userLine(executorId), inline: true },
                        { name: 'Indok', value: reason }
                    )
            );
        } else if (action === AuditLogEvent.MemberBanRemove) {
            removeTempBan(guild.id, targetId); // ha kézzel oldották fel, az időzítő ne foglalkozzon vele
            await sendDevlog(
                new EmbedBuilder()
                    .setColor(LOG_COLORS.unban)
                    .setTitle('✅ Tiltás feloldva')
                    .addFields(
                        { name: 'Felhasználó', value: userLine(targetId), inline: true },
                        { name: 'Moderátor', value: userLine(executorId), inline: true },
                        { name: 'Indok', value: reason }
                    )
            );
        } else if (action === AuditLogEvent.MemberUpdate) {
            const change = entry.changes?.find(c => c.key === 'communication_disabled_until');
            if (!change) return;

            const until = change.new ? new Date(change.new).getTime() : null;
            const active = until && until > Date.now();

            const embed = new EmbedBuilder()
                .setColor(LOG_COLORS.timeout)
                .setTitle(active ? '🔇 Timeout' : '🔊 Timeout levéve')
                .addFields(
                    { name: 'Felhasználó', value: userLine(targetId), inline: true },
                    { name: 'Moderátor', value: userLine(executorId), inline: true }
                );
            if (active) embed.addFields({ name: 'Lejár', value: fullTime(until) });
            embed.addFields({ name: 'Indok', value: reason });
            await sendDevlog(embed);
        }
    } catch (error) {
        console.error('Audit log hiba:', error);
    }
});

// ---------- Belépő tagok: üdvözlő + devlog ----------
client.on(Events.GuildMemberAdd, async member => {
    // Üdvözlő üzenet (botokat nem üdvözlünk)
    if (!member.user.bot) {
        try {
            const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
            const welcome = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle(`Üdv a szerveren, ${member.displayName}! 👋`)
                .setDescription(
                    `Örülünk, hogy csatlakoztál, ${member}!\n` +
                    `Te vagy a(z) **${member.guild.memberCount}.** tagunk.` + WIDE_PAD
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setFooter({ text: member.guild.name });

            await channel.send({
                content: `${member}`,
                embeds: [welcome],
                allowedMentions: { users: [member.id] }
            });
        } catch (error) {
            console.error('Üdvözlő hiba:', error.message);
        }
    }

    // Devlog
    const created = member.user.createdTimestamp;
    const isNewAccount = Date.now() - created < 7 * 24 * 60 * 60 * 1000;
    const embed = new EmbedBuilder()
        .setColor(LOG_COLORS.join)
        .setTitle(member.user.bot ? '🤖 Bot csatlakozott' : '📥 Új tag csatlakozott')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'Felhasználó', value: userLine(member.id), inline: true },
            { name: 'Tagok száma', value: String(member.guild.memberCount), inline: true },
            {
                name: 'Fiók létrehozva',
                value: fullTime(created) + (isNewAccount ? '\n⚠️ **Új fiók (7 napnál fiatalabb)**' : '')
            }
        );
    await sendDevlog(embed);
});

// ---------- Kilépő tagok (kick/ban esetén nem naplózzuk külön) ----------
client.on(Events.GuildMemberRemove, async member => {
    try {
        await sleep(2500); // várunk, hogy az audit log esemény (kick/ban) is megérkezzen
        if (recentRemovals.has(member.id)) return;

        const embed = new EmbedBuilder()
            .setColor(LOG_COLORS.leave)
            .setTitle('📤 Tag kilépett')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Felhasználó', value: userLine(member.id), inline: true },
                { name: 'Tagok száma', value: String(member.guild.memberCount), inline: true }
            );
        if (member.joinedTimestamp) embed.addFields({ name: 'Csatlakozott', value: fullTime(member.joinedTimestamp) });
        await sendDevlog(embed);
    } catch (error) {
        console.error('Kilépés log hiba:', error);
    }
});

// ---------- Üzenetek törlése / szerkesztése ----------
// Csak azokat látja a bot, amik már a memóriájában voltak (újraindítás előtti üzeneteket nem).
client.on(Events.MessageDelete, async message => {
    try {
        if (message.partial || !message.guild || message.author?.bot) return;
        if (message.channelId === DEVLOG_CHANNEL_ID || clearing.has(message.channelId)) return;

        const embed = new EmbedBuilder()
            .setColor(LOG_COLORS.message)
            .setTitle('🗑️ Üzenet törölve')
            .addFields(
                { name: 'Szerző', value: userLine(message.author?.id), inline: true },
                { name: 'Csatorna', value: `<#${message.channelId}>`, inline: true },
                { name: 'Tartalom', value: shorten(message.content || '*(nincs szöveg)*') }
            );
        if (message.attachments?.size) {
            embed.addFields({ name: 'Mellékletek', value: `${message.attachments.size} db` });
        }
        await sendDevlog(embed);
    } catch (error) {
        console.error('Törlés log hiba:', error);
    }
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (newMessage.channelId === DEVLOG_CHANNEL_ID) return;
        if (!oldMessage.content || newMessage.content == null || oldMessage.content === newMessage.content) return;

        await sendDevlog(
            new EmbedBuilder()
                .setColor(LOG_COLORS.message)
                .setTitle('✏️ Üzenet szerkesztve')
                .addFields(
                    { name: 'Szerző', value: userLine(newMessage.author?.id), inline: true },
                    { name: 'Csatorna', value: `<#${newMessage.channelId}>`, inline: true },
                    { name: 'Előtte', value: shorten(oldMessage.content, 1000) },
                    { name: 'Utána', value: shorten(newMessage.content, 1000) },
                    { name: 'Link', value: `[Ugrás az üzenethez](${newMessage.url})` }
                )
        );
    } catch (error) {
        console.error('Szerkesztés log hiba:', error);
    }
});

// ---------- /rank: rangválasztó reakciókkal ----------
// Aki rákattint egy reakcióra, megkapja a rangot; aki leveszi a reakciót, elveszti.
const RANK_ROLES = [
    { emoji: '💻', name: 'Scripter', roleId: '1551648671848730705' },
    { emoji: '🧊', name: 'Modeller', roleId: '1551648337382350919' },
    { emoji: '🧱', name: 'Builder', roleId: '1551649044567302247' },
    { emoji: '🎬', name: 'Animator', roleId: '1551648186542858391' },
    { emoji: '🎨', name: 'UI/UX Designer', roleId: '1551648491938521230' }
];

// A /rank üzenetek ID-i fájlban, hogy újraindítás után is működjenek a reakciók
const RANKPANEL_FILE = path.join(__dirname, 'rankpanels.json');
let rankPanels = new Set();
try {
    const saved = JSON.parse(fs.readFileSync(RANKPANEL_FILE, 'utf8'));
    if (Array.isArray(saved)) rankPanels = new Set(saved);
} catch {
    rankPanels = new Set();
}

function saveRankPanels() {
    try {
        fs.writeFileSync(RANKPANEL_FILE, JSON.stringify([...rankPanels], null, 2));
    } catch (error) {
        console.error('A rankpanels.json nem menthető:', error.message);
    }
}

async function handleRankCommand(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: 'Ez a parancs csak szerveren használható.', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!canModerate(interaction, PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
            content: 'Ehhez a parancshoz **Manage Roles** jog kell (vagy a szerver tulajdonosa legyél).',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;

    // Előre ellenőrizzük, hogy a rangok léteznek és a bot kezelni tudja őket
    const problems = [];
    for (const r of RANK_ROLES) {
        const role = await guild.roles.fetch(r.roleId).catch(() => null);
        if (!role) problems.push(`**${r.name}**: nem található ilyen rang`);
        else if (!role.editable) problems.push(`**${r.name}**: a bot rangja nincs a rang fölött (vagy hiányzik a Manage Roles jog)`);
    }
    if (problems.length) {
        await interaction.editReply({ content: `❌ Nem tudom létrehozni, mert:\n${problems.join('\n')}` });
        return;
    }

    // A parancsba nem lehet új sort írni, ezért a \n karaktereket új sorra cseréljük
    const text = interaction.options.getString('text', true).replace(/\\n/g, '\n').trim();
    const legend = RANK_ROLES.map(r => `${r.emoji} → <@&${r.roleId}>`).join('\n');

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setDescription(`${text}\n\n${legend}`)
        .setFooter({ text: 'Kattints a reakcióra a rang megszerzéséhez, vedd le a rang elvételéhez.' });

    try {
        const message = await interaction.channel.send({ embeds: [embed] });
        rankPanels.add(message.id);
        saveRankPanels();

        for (const r of RANK_ROLES) {
            await message.react(r.emoji);
        }
    } catch (error) {
        console.error('Rank üzenet hiba:', error);
        await interaction.editReply({
            content: '❌ Nem sikerült elküldeni vagy reagálni. A botnak kell: Send Messages, Embed Links, Add Reactions, Read Message History.'
        });
        return;
    }

    await interaction.editReply({ content: '✅ Kész, a rangválasztó üzenet kint van.' });
}

async function handleRankReaction(reaction, user, added) {
    try {
        if (user.bot) return;
        if (!rankPanels.has(reaction.message.id)) return;

        if (reaction.partial) await reaction.fetch();

        const rank = RANK_ROLES.find(r => r.emoji === reaction.emoji.name);
        if (!rank) {
            // Nem ide tartozó reakció: leszedjük, hogy tiszta maradjon a panel
            if (added) await reaction.users.remove(user.id).catch(() => {});
            return;
        }

        const guildId = reaction.message.guildId;
        const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
        const member = await guild.members.fetch(user.id);

        if (added) {
            await member.roles.add(rank.roleId, 'Rang reakcióval');
        } else {
            await member.roles.remove(rank.roleId, 'Rang reakció levéve');
        }
    } catch (error) {
        console.error('Rank reakció hiba:', error.message);
    }
}

client.on(Events.MessageReactionAdd, (reaction, user) => handleRankReaction(reaction, user, true));
client.on(Events.MessageReactionRemove, (reaction, user) => handleRankReaction(reaction, user, false));

// Ha törlik a rangválasztó üzenetet, kivesszük a listából
client.on(Events.MessageDelete, message => {
    if (rankPanels.delete(message.id)) saveRankPanels();
});

// ---------- Gombok ----------
async function handleButton(interaction) {
    const [action, a, b, c] = interaction.customId.split(':');

    switch (action) {
        case 'back':
            await interaction.update(renderMainMenu());
            return;

        case 'create_new_post':
            await interaction.update(renderCategoryPicker());
            return;

        case 'edit_repost': {
            const mine = [...drafts.values()].filter(d => d.userId === interaction.user.id).slice(-25).reverse();
            if (!mine.length) {
                await interaction.reply({
                    content: 'Még nincs korábbi posztod. Használd az „Új poszt létrehozása” gombot!',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId('edit_pick')
                .setPlaceholder('Válaszd ki a szerkeszteni kívánt posztot')
                .addOptions(
                    mine.map(d =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel((d.title || 'Cím nélküli poszt').slice(0, 100))
                            .setDescription(`${CATEGORIES[d.category].label} • ${d.status}`)
                            .setValue(d.id)
                    )
                );

            await interaction.update({
                content: 'Válaszd ki a szerkeszteni kívánt posztot:',
                embeds: [],
                components: [new ActionRowBuilder().addComponents(select), backRow()]
            });
            return;
        }

        case 'edit_info': {
            const draft = await getOwnDraft(interaction, a);
            if (!draft) return;

            const titleInput = new TextInputBuilder()
                .setCustomId('post_title')
                .setLabel('Poszt címe')
                .setPlaceholder('Röviden írd le a posztod tárgyát')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(256)
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('post_desc')
                .setLabel('Poszt leírása')
                .setPlaceholder('A poszt fő szövege. Légy részletes.')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(3500)
                .setRequired(true);

            const imageInput = new TextInputBuilder()
                .setCustomId('post_image')
                .setLabel('Kép URL')
                .setPlaceholder('Opcionális kép URL az embedhez.')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const thumbInput = new TextInputBuilder()
                .setCustomId('post_thumb')
                .setLabel('Bélyegkép (thumbnail) URL')
                .setPlaceholder('Kis, opcionális kép URL, jobb felül jelenik meg.')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            if (draft.title) titleInput.setValue(draft.title);
            if (draft.desc) descInput.setValue(draft.desc);
            if (draft.image) imageInput.setValue(draft.image);
            if (draft.thumbnail) thumbInput.setValue(draft.thumbnail);

            const modal = new ModalBuilder()
                .setCustomId(`modal_info:${draft.id}`)
                .setTitle('Poszt szerkesztése ("Küldés" a mentéshez)')
                .addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(imageInput),
                    new ActionRowBuilder().addComponents(thumbInput)
                );

            await interaction.showModal(modal);
            return;
        }

        case 'edit_pay': {
            const draft = await getOwnDraft(interaction, a);
            if (!draft) return;

            const payInput = new TextInputBuilder()
                .setCustomId('pay_types')
                .setLabel('Fizetési típusok (soronként egy)')
                .setPlaceholder('Soronként egy, pl.: 5000 Robux vagy 20 USD (PayPal)')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(true);

            if (draft.payments) payInput.setValue(draft.payments);

            const modal = new ModalBuilder()
                .setCustomId(`modal_pay:${draft.id}`)
                .setTitle('Fizetési típusok szerkesztése')
                .addComponents(new ActionRowBuilder().addComponents(payInput));

            await interaction.showModal(modal);
            return;
        }

        case 'submit': {
            const draft = await getOwnDraft(interaction, a);
            if (!draft) return;

            if (!isComplete(draft)) {
                await interaction.update(renderEditor(draft, '⚠️ Még nem töltöttél ki minden kötelező (*) mezőt.'));
                return;
            }

            const cat = CATEGORIES[draft.category];
            const target = cat.channels[draft.channelIdx];

            if (!target || !target.id) {
                await interaction.reply({
                    content: 'Ehhez a csatornához még nincs beállítva azonosító, szólj egy adminnak!',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const targetChannel = await client.channels.fetch(target.id).catch(() => null);
            if (!targetChannel) {
                await interaction.reply({
                    content: 'A kiválasztott csatorna nem található (rossz azonosító, vagy a bot nem éri el), szólj egy adminnak!',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
            if (!adminChannel) {
                await interaction.reply({
                    content: 'Az admin csatorna nem érhető el, szólj egy adminnak!',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const reviewEmbed = buildPreviewEmbed(draft)
                .addFields(
                    { name: FIELD_CATEGORY, value: cat.label, inline: true },
                    { name: FIELD_CHANNEL, value: `<#${target.id}>`, inline: true }
                )
                .setFooter({ text: `Beküldő: ${draft.username} | Státusz: Review alatt | Poszt ID: ${draft.id}` });

            // customId: művelet : beküldő ID : célcsatorna ID : poszt ID
            const adminRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`approve_post:${draft.userId}:${target.id}:${draft.id}`)
                    .setLabel('Jóváhagyás')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_post:${draft.userId}:${target.id}:${draft.id}`)
                    .setLabel('Elutasítás')
                    .setStyle(ButtonStyle.Danger)
            );

            // Előbb nyugtázzuk az interakciót: ha véletlenül több bot példány fut, csak az egyik
            // jut idáig, a többi itt megáll, így nem kerül duplán az admin szobába a poszt.
            await interaction.deferUpdate();

            await adminChannel.send({
                content: `Új poszt érkezett jóváhagyásra <@${draft.userId}> által:`,
                embeds: [reviewEmbed],
                components: [adminRow],
                allowedMentions: { parse: [] }
            });

            draft.status = 'Beküldve';

            await interaction.editReply({
                content:
                    '✅ A poszt sikeresen elküldve az adminoknak áttekintésre! Ha módosítanád, használd a `/post` parancsot, majd a „Szerkesztés/Újraposztolás” gombot.',
                embeds: [],
                components: []
            });
            return;
        }

        case 'clear_cancel':
            await interaction.update({ content: 'Megszakítva, nem törlődött semmi.', components: [] });
            return;

        case 'clear_confirm': {
            // customId: clear_confirm : csatorna ID : parancsot kiadó felhasználó ID
            if (interaction.user.id !== b || !canClear(interaction)) {
                await interaction.reply({
                    content: 'Ezt a megerősítést nem te indítottad, vagy nincs jogosultságod hozzá.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const channel = interaction.channel;
            if (!channel || channel.id !== a) {
                await interaction.reply({ content: 'A csatorna nem található.', flags: MessageFlags.Ephemeral });
                return;
            }

            // Előbb nyugtázzuk az interakciót (duplázás ellen)
            await interaction.deferUpdate();

            if (clearing.has(channel.id)) {
                await interaction.editReply({ content: 'Ebben a csatornában már folyamatban van a törlés.', components: [] });
                return;
            }

            clearing.add(channel.id);
            try {
                await interaction.editReply({ content: '🧹 Törlés folyamatban…', components: [] });

                const total = await clearChannel(channel, count =>
                    interaction.editReply({ content: `🧹 Törlés folyamatban… eddig ${count} üzenet törölve.` })
                );

                await interaction.editReply({ content: `✅ Kész! ${total} üzenet törölve.` }).catch(() => {});

                await sendDevlog(
                    new EmbedBuilder()
                        .setColor(LOG_COLORS.message)
                        .setTitle('🧹 Csatorna kiürítve (/clear)')
                        .addFields(
                            { name: 'Csatorna', value: `<#${channel.id}>`, inline: true },
                            { name: 'Ki használta', value: userLine(interaction.user.id), inline: true },
                            { name: 'Törölt üzenetek', value: String(total), inline: true }
                        )
                );
            } catch (error) {
                console.error('Clear hiba:', error);
                await interaction.editReply({ content: '❌ Hiba történt a törlés közben, nézd meg a bot jogosultságait.' }).catch(() => {});
            } finally {
                clearing.delete(channel.id);
            }
            return;
        }

        case 'report_post': {
            // customId: report_post : beküldő ID : poszt ID
            const reasonInput = new TextInputBuilder()
                .setCustomId('report_reason')
                .setLabel('Indoklás')
                .setPlaceholder('A jelentés oka. Győződj meg róla, hogy tényleg szabályszegés.')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(true);

            const mediaInput = new TextInputBuilder()
                .setCustomId('report_media')
                .setLabel('Média')
                .setPlaceholder('Kép vagy videó linkek, vesszővel/szóközzel elválasztva.')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(false);

            const modal = new ModalBuilder()
                .setCustomId(`modal_report:${a}:${b}`)
                .setTitle('Poszt jelentése')
                .addComponents(
                    new ActionRowBuilder().addComponents(reasonInput),
                    new ActionRowBuilder().addComponents(mediaInput)
                );

            await interaction.showModal(modal);
            return;
        }

        case 'remove_post': {
            // customId: remove_post : beküldő ID : poszt ID
            const submitterId = a;
            const postId = b;
            const isOwner = interaction.guild?.ownerId === interaction.user.id;
            const isSubmitter = submitterId === interaction.user.id;

            if (!isOwner && !isSubmitter) {
                await interaction.reply({
                    content: 'Ezt a posztot csak a szerver tulajdonosa vagy a beküldője törölheti.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await interaction.deferUpdate();
            await interaction.message.delete();
            const post = drafts.get(postId);
            if (post) post.status = 'Törölve';

            await interaction.followUp({
                content: '🗑️ A poszt törölve.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        case 'approve_post':
        case 'reject_post': {
            const submitterId = a;
            const channelId = b;
            const postId = c;

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                await interaction.reply({
                    content: 'Ehhez nincs jogosultságod.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Előbb nyugtázzuk az interakciót: ha véletlenül több bot példány fut, csak az egyik
            // jut tovább, a többi itt megáll, így nem posztol duplán.
            await interaction.deferUpdate();

            const post = drafts.get(postId);

            if (action === 'reject_post') {
                if (post) post.status = 'Elutasítva';
                await interaction.editReply({
                    content: `❌ **Elutasítva** (${interaction.user}).`,
                    components: []
                });
                return;
            }

            // Jóváhagyás -> publikálás a kiválasztott csatornába
            const publicChannel = channelId
                ? await client.channels.fetch(channelId).catch(() => null)
                : null;

            if (!publicChannel) {
                await interaction.followUp({
                    content: 'A célcsatorna nem található vagy a bot nem éri el.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const publicEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
            publicEmbed
                .setFields((publicEmbed.data.fields ?? []).filter(f => f.name !== FIELD_CATEGORY && f.name !== FIELD_CHANNEL))
                .setFooter({ text: `Poszt ID: (${postId}) • Jóváhagyva` })
                .setTimestamp()
                .setColor(EMBED_COLOR);

            const postRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`report_post:${submitterId}:${postId}`)
                    .setLabel('Poszt jelentése')
                    .setEmoji('🚩')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`remove_post:${submitterId}:${postId}`)
                    .setLabel('Törlés')
                    .setStyle(ButtonStyle.Danger)
            );

            await publicChannel.send({
                content: `Beküldte: <@${submitterId}>`,
                embeds: [publicEmbed],
                components: [postRow],
                allowedMentions: { parse: [] }
            });

            if (post) post.status = 'Jóváhagyva';

            await interaction.editReply({
                content: `✅ **Jóváhagyva és publikálva** (${interaction.user}).`,
                components: []
            });
            return;
        }
    }
}

// ---------- Lenyílók ----------
async function handleSelect(interaction) {
    const [action, id] = interaction.customId.split(':');

    if (action === 'category_select') {
        const category = interaction.values[0];
        if (!CATEGORIES[category]) return;

        const draft = {
            id: interaction.id,
            userId: interaction.user.id,
            username: interaction.user.username,
            avatar: interaction.user.displayAvatarURL(),
            category,
            title: '',
            desc: '',
            image: '',
            thumbnail: '',
            channelIdx: null,
            contacts: [],
            schedule: null,
            payments: '',
            status: 'Piszkozat'
        };
        drafts.set(draft.id, draft);

        await interaction.update(renderEditor(draft));
        return;
    }

    if (action === 'edit_pick') {
        const draft = await getOwnDraft(interaction, interaction.values[0]);
        if (!draft) return;
        draft.status = 'Piszkozat';
        await interaction.update(renderEditor(draft));
        return;
    }

    const draft = await getOwnDraft(interaction, id);
    if (!draft) return;

    if (action === 'sel_channel') {
        const idx = Number(interaction.values[0]);
        if (CATEGORIES[draft.category].channels[idx]) draft.channelIdx = idx;
    } else if (action === 'sel_contact') {
        draft.contacts = interaction.values.filter(v => v === 'discord');
    } else if (action === 'sel_pay') {
        if (SCHEDULES[interaction.values[0]]) draft.schedule = interaction.values[0];
    } else {
        return;
    }

    await interaction.update(renderEditor(draft));
}

// ---------- Űrlapok (modal) ----------
async function handleModal(interaction) {
    const [action, id, extra] = interaction.customId.split(':');

    // Poszt jelentése (bárki jelenthet, nem a piszkozathoz tartozik)
    if (action === 'modal_report') {
        const submitterId = id;
        const postId = extra;
        const reason = interaction.fields.getTextInputValue('report_reason').trim();
        const mediaRaw = interaction.fields.getTextInputValue('report_media').trim();
        const media = mediaRaw ? mediaRaw.split(/[,\s]+/).filter(isValidUrl) : [];

        // Előbb nyugtázzuk az interakciót (duplázás ellen)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const reportChannel = await client.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
        if (!reportChannel) {
            await interaction.editReply({
                content: 'A jelentések csatornája nem érhető el, szólj egy adminnak!'
            });
            return;
        }

        const postUrl = interaction.message?.url;

        const reportEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setTitle('🚩 Poszt jelentve')
            .setDescription(reason)
            .addFields(
                { name: 'Jelentő', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Poszt beküldője', value: `<@${submitterId}>`, inline: true },
                { name: 'Poszt', value: postUrl ? `[Ugrás a poszthoz](${postUrl})` : `ID: ${postId}` }
            )
            .setFooter({ text: `Poszt ID: (${postId})` })
            .setTimestamp();

        if (media.length) {
            reportEmbed.addFields({ name: 'Média', value: media.join('\n').slice(0, 1024) });
            if (media[0] && /\.(png|jpe?g|gif|webp|bmp|avif)(\?|$)/i.test(media[0])) {
                reportEmbed.setImage(media[0]);
            }
        }

        await reportChannel.send({ embeds: [reportEmbed], allowedMentions: { parse: [] } });

        await interaction.editReply({
            content: '✅ Köszönjük, a jelentést továbbítottuk az adminoknak.'
        });
        return;
    }

    const draft = await getOwnDraft(interaction, id);
    if (!draft) return;

    let notice = '';

    if (action === 'modal_info') {
        draft.title = interaction.fields.getTextInputValue('post_title').trim();
        draft.desc = interaction.fields.getTextInputValue('post_desc').trim();

        const image = interaction.fields.getTextInputValue('post_image').trim();
        const thumb = interaction.fields.getTextInputValue('post_thumb').trim();
        const invalid = [];

        if (image && !isValidUrl(image)) {
            invalid.push('Kép URL');
            draft.image = '';
        } else {
            draft.image = image;
        }

        if (thumb && !isValidUrl(thumb)) {
            invalid.push('Bélyegkép URL');
            draft.thumbnail = '';
        } else {
            draft.thumbnail = thumb;
        }

        if (invalid.length) {
            notice = `⚠️ Érvénytelen link (${invalid.join(', ')}), ezek nem lettek mentve. http:// vagy https:// kezdetű URL kell.`;
        }
    } else if (action === 'modal_pay') {
        draft.payments = interaction.fields.getTextInputValue('pay_types').trim();
    } else {
        return;
    }

    if (interaction.isFromMessage()) {
        await interaction.update(renderEditor(draft, notice));
    } else {
        await interaction.reply({ ...renderEditor(draft, notice), flags: MessageFlags.Ephemeral });
    }
}

// ---------- Egyetlen interaction handler ----------
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'post') {
                if (!isVerified(interaction)) {
                    await interaction.reply({
                        content: 'A `/post` használatához **Verified** rang kell.',
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.reply({ ...renderMainMenu(), flags: MessageFlags.Ephemeral });
                }
            } else if (interaction.commandName === 'clear') {
                await handleClearCommand(interaction);
            } else if (interaction.commandName === 'mod') {
                await handleModCommand(interaction);
            } else if (interaction.commandName === 'rank') {
                await handleRankCommand(interaction);
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('mod:')) await handleModButton(interaction);
            else await handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await handleSelect(interaction);
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('modm:')) await handleModModal(interaction);
            else await handleModal(interaction);
        }
    } catch (error) {
        console.error('Interaction hiba:', error);
        const msg = { content: 'Hiba történt, próbáld újra később.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg).catch(() => {});
        } else {
            await interaction.reply(msg).catch(() => {});
        }
    }
});

client.login(TOKEN);
