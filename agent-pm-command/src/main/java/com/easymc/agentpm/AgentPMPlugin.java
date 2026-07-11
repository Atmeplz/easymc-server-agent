package com.easymc.agentpm;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * AgentPM - lightweight private message command for the EasyMC @agent system.
 *
 * Registers /agentpm <message>. When a player runs it, the plugin prints a
 * tagged line to the server console which chat-monitor.js recognises as a
 * whispered agent request. The reply is then sent back via /tell.
 */
public final class AgentPMPlugin extends JavaPlugin implements CommandExecutor {

    private static final String CONSOLE_TAG = "[AgentPM]";

    @Override
    public void onEnable() {
        getCommand("agentpm").setExecutor(this);
        getLogger().info("AgentPM enabled. Players can use /agentpm <message>.");
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage("Only players can use /agentpm.");
            return true;
        }

        if (args.length == 0) {
            sender.sendMessage("Usage: /agentpm <message>");
            return true;
        }

        Player player = (Player) sender;
        String message = String.join(" ", args);

        // Print a tagged line to the console. chat-monitor.js parses this format.
        // Use System.out so the tag appears verbatim regardless of logger prefix config.
        System.out.println(CONSOLE_TAG + " " + player.getName() + " " + message);

        player.sendMessage("§7[Agent] §fMessage sent privately.");
        return true;
    }
}
