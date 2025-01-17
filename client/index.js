const token = require("../data/config.json").token
const { Client, SlashCommandBuilder, REST, Routes, IntentsBitField, PermissionFlagsBits }= require("discord.js")

let client = new Client({ intents: [IntentsBitField.Flags.GuildMessages] })

const rest = new REST({ version: '10' }).setToken(token);
let restartCmd = new SlashCommandBuilder()
        .setName("restart")
        .setDescription("Reinicia o bot.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
let logsCmd = new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Vê os logs do bot.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
client.on("ready", async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, "1286100228008574986"), {
            body: [restartCmd.toJSON(), logsCmd.toJSON()]
        });
        console.log('Successfully registered application commands for guild');
    } catch (error) {
        if (error) console.error(error);
    }
    console.log("Bot's ready!")
})

let modules;

client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
        if (interaction.commandName === "restart") {
            modules.restart();
            interaction.reply(":white_check_mark: API has been restarted!")
        } else if (interaction.commandName === "logs") {
            interaction.reply("```" + modules.getLogs().slice(-1995).replaceAll("\\n","\n") + "```")
        }
    }
})

module.exports.login = (a) => {
    modules = a;
    client.login(token)
}