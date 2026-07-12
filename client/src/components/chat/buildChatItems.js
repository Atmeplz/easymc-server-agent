export default function buildChatItems(messages) {
  const items = [];
  let toolGroup = null;

  messages.forEach((message) => {
    if (message.role === 'tool') {
      if (!toolGroup) {
        toolGroup = {
          kind: 'toolGroup',
          id: `tool-group-${message.id || message.timestamp || items.length}`,
          tools: [],
        };
        items.push(toolGroup);
      }
      toolGroup.tools.push(message);
      return;
    }

    toolGroup = null;
    items.push({
      kind: 'message',
      id: message.id,
      message,
    });
  });

  return items;
}
