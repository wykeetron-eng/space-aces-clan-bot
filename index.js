const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const API_URL = process.env.API_URL;

const UPDATE_INTERVAL = 2 * 60 * 1000; // 2 minutos

if (!TOKEN) {
    throw new Error("Falta la variable DISCORD_TOKEN");
}

if (!CHANNEL_ID) {
    throw new Error("Falta la variable CHANNEL_ID");
}

if (!API_URL) {
    throw new Error("Falta la variable API_URL");
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const dataDir = path.join(__dirname, "data");
const stateFile = path.join(dataDir, "state.json");

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function loadState() {
    if (!fs.existsSync(stateFile)) {
        return {};
    }

    try {
        return JSON.parse(
            fs.readFileSync(stateFile, "utf8")
        );
    } catch (error) {
        console.error(
            "No se pudo leer state.json:",
            error.message
        );

        return {};
    }
}

function saveState(state) {
    try {
        fs.writeFileSync(
            stateFile,
            JSON.stringify(state, null, 2)
        );
    } catch (error) {
        console.error(
            "No se pudo guardar state.json:",
            error.message
        );
    }
}

let state = loadState();

function formatNumber(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "—";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return String(value);
    }

    return number.toLocaleString("es-ES");
}

function formatDate(timestamp) {
    if (!timestamp) {
        return "—";
    }

    const seconds = Math.floor(
        Number(timestamp) / 1000
    );

    if (!Number.isFinite(seconds)) {
        return "—";
    }

    return `<t:${seconds}:R>`;
}

function normalizeCollection(collection) {
    if (!collection) {
        return [];
    }

    if (Array.isArray(collection)) {
        return collection;
    }

    if (typeof collection === "object") {
        return Object.entries(collection).map(
            ([id, value]) => ({
                _id: id,
                ...value
            })
        );
    }

    return [];
}

function getActionName(actionType) {
    const actions = {
        clan_role_member_add:
            "🟢 Miembro añadido",

        clan_role_member_remove:
            "🔴 Miembro eliminado",

        clan_member_add:
            "🟢 Miembro añadido",

        clan_member_remove:
            "🔴 Miembro eliminado",

        clan_role_add:
            "🔵 Rol añadido",

        clan_role_remove:
            "🟠 Rol eliminado"
    };

    return (
        actions[actionType] ||
        `🔹 ${actionType || "Actividad"}`
    );
}

async function getClanData() {
    const response = await fetch(API_URL, {
        headers: {
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(
            `La API respondió con HTTP ${response.status}`
        );
    }

    return await response.json();
}

function createMainEmbed(data) {
    const embed = new EmbedBuilder()
        .setTitle(
            `🏰 ${data.name || "Clan"}`
        )
        .setDescription(
            data.tag
                ? `**[${data.tag}]**`
                : "Estadísticas del clan"
        )
        .addFields(
            {
                name: "📊 Información",
                value:
                    `**Nivel:** \`${formatNumber(data.lvl)}\`\n` +
                    `**XP:** \`${formatNumber(data.xp)}\`\n` +
                    `**Ranking:** \`#${formatNumber(data.ranking)}\`\n` +
                    `**Miembros:** \`${formatNumber(data.memberCount)} / ${formatNumber(data.maxSlots)}\``,
                inline: true
            },
            {
                name: "💰 Recursos",
                value:
                    `💳 **Créditos:** \`${formatNumber(data.clanCredits)}\`\n` +
                    `💎 **Uritaium:** \`${formatNumber(data.clanUritaium)}\``,
                inline: true
            },
            {
                name: "⚔️ Estadísticas",
                value:
                    `⚔️ **PvP:** \`${formatNumber(data.totalPvPKills)}\`\n` +
                    `👾 **PvE:** \`${formatNumber(data.totalPvEKills)}\`\n` +
                    `⭐ **XP total:** \`${formatNumber(data.totalXp)}\``,
                inline: true
            }
        )
        .setFooter({
            text: "Space Aces • Actualización automática"
        })
        .setTimestamp();

    return embed;
}

function createUpgradesEmbed(data) {
    const upgrades = normalizeCollection(
        data.upgrades
    );

    if (upgrades.length === 0) {
        return new EmbedBuilder()
            .setTitle("📈 Mejoras del clan")
            .setDescription(
                "No hay mejoras disponibles."
            )
            .setTimestamp();
    }

    const text = upgrades
        .map((upgrade) => {
            const type =
                upgrade.type ?? "Desconocido";

            const lvl =
                upgrade.lvl ?? "—";

            return (
                `🔹 **${type}** — Nivel \`${lvl}\``
            );
        })
        .join("\n");

    return new EmbedBuilder()
        .setTitle("📈 Mejoras del clan")
        .setDescription(text.slice(0, 4096))
        .setTimestamp();
}

function createActivityEmbed(data) {
    const actions = normalizeCollection(
        data.actionList
    );

    if (actions.length === 0) {
        return new EmbedBuilder()
            .setTitle("📋 Actividad reciente")
            .setDescription(
                "No hay actividad registrada."
            )
            .setTimestamp();
    }

    const recent = actions
        .sort(
            (a, b) =>
                Number(b.date || 0) -
                Number(a.date || 0)
        )
        .slice(0, 10);

    const text = recent
        .map((action) => {
            const actionName =
                getActionName(
                    action.actionType
                );

            return (
                `${actionName}\n` +
                `👤 **Objetivo:** ${action.target || "—"}\n` +
                `👮 **Por:** ${action.by || "—"}\n` +
                `🕐 ${formatDate(action.date)}`
            );
        })
        .join("\n\n");

    return new EmbedBuilder()
        .setTitle("📋 Actividad reciente")
        .setDescription(text.slice(0, 4096))
        .setTimestamp();
}

async function getChannel() {
    const channel =
        await client.channels.fetch(
            CHANNEL_ID
        );

    if (!channel) {
        throw new Error(
            "No se encontró el canal de Discord."
        );
    }

    return channel;
}

async function sendOrUpdateMessage(
    channel,
    key,
    embed
) {
    const messageId = state[key];

    if (messageId) {
        try {
            const message =
                await channel.messages.fetch(
                    messageId
                );

            await message.edit({
                embeds: [embed]
            });

            return;
        } catch (error) {
            console.log(
                `No se pudo editar ${key}. Se creará uno nuevo.`
            );
        }
    }

    const message =
        await channel.send({
            embeds: [embed]
        });

    state[key] = message.id;

    saveState(state);
}

async function updateDiscord() {
    try {
        console.log(
            `[${new Date().toISOString()}] Consultando API...`
        );

        const data = await getClanData();

        const channel =
            await getChannel();

        await sendOrUpdateMessage(
            channel,
            "mainMessage",
            createMainEmbed(data)
        );

        await sendOrUpdateMessage(
            channel,
            "upgradesMessage",
            createUpgradesEmbed(data)
        );

        await sendOrUpdateMessage(
            channel,
            "activityMessage",
            createActivityEmbed(data)
        );

        console.log(
            "✓ Discord actualizado correctamente."
        );

    } catch (error) {
        console.error(
            "❌ Error actualizando Discord:",
            error
        );
    }
}

client.once("ready", async () => {
    console.log(
        `✓ Conectado como ${client.user.tag}`
    );

    await updateDiscord();

    setInterval(
        updateDiscord,
        UPDATE_INTERVAL
    );
});

client.login(TOKEN);
