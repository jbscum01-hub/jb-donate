export async function collectAllAttachments(textChannel, limit = 1000) {
  // Fetch messages backwards and collect attachments.
  // NOTE: Discord API pagination is limited; for very large tickets you may want a stricter limit.
  let lastId = null;
  const attachments = [];
  for (let i = 0; i < 10; i++) { // up to 10 pages * 100 = 1000 messages
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const msgs = await textChannel.messages.fetch(options);
    if (!msgs.size) break;

    for (const m of msgs.values()) {
      for (const a of m.attachments.values()) {
        attachments.push({ url: a.url, name: a.name, contentType: a.contentType, size: a.size });
      }
    }
    lastId = msgs.last().id;
    if (attachments.length >= limit) break;
  }
  return attachments;
}
