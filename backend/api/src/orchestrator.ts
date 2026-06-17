import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type ToolRouting = {
  client: Client;
  serverId: string;
  originalToolName: string;
  inputSchema: any;
};

export class Orchestrator {
  private toolMap = new Map<string, ToolRouting>();
  private clients = new Map<string, Client>();

  async connectServer(
    serverId: string,
    command: string,
    args: string[]
  ) {
    const transport = new StdioClientTransport({ command, args, stderr: "inherit" });
    const client = new Client({
      name: `orchestrator-${serverId}`,
      version: "1.0.0"
    });

    await client.connect(transport);

    const toolsResponse = await client.listTools();

    for (const tool of toolsResponse.tools) {
      const namespacedName = `${serverId}.${tool.name}`;

      this.toolMap.set(namespacedName, {
        client,
        serverId,
        originalToolName: tool.name,
        inputSchema: tool.inputSchema ?? {}
      });
    }

    this.clients.set(serverId, client);
  }

  listTools(): string[] {
    return Array.from(this.toolMap.keys());
  }

  async callTool(
    namespacedToolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const routing = this.toolMap.get(namespacedToolName);
    if (!routing) {
      throw new Error(`Unknown tool: ${namespacedToolName}`);
    }

    const result = await routing.client.callTool({
      name: routing.originalToolName,
      arguments: args
    });

    return result;
  }

  async disconnect() {
    for (const client of this.clients.values()) {
      // Note: SDK doesn't have a formal disconnect method yet
    }
  }
}
