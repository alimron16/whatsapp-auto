const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('ready', async () => {
  console.log('WhatsApp siap!');

  // Ambil semua chat
  const chats = await client.getChats();

  // Filter hanya grup
  const groups = chats.filter(chat => chat.isGroup);

  // Tampilkan nama grup dan ID
  groups.forEach(group => {
    console.log(`Nama Grup : ${group.name}`);
    console.log(`ID Grup   : ${group.id._serialized}`);
    console.log('--------------------------------');
  });
});

client.initialize();