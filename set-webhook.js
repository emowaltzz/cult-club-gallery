const BOT_TOKEN = '9282771149:AAG8sfR7iDHAqffvmgvllqOvy-DV0jYIKVY';

// Vercel автоматически подставляет сюда ссылку на твой текущий проект
const VERCEL_URL = process.env.VERCEL_URL; 

async function setWebhook() {
  if (!VERCEL_URL) {
    console.log('VERCEL_URL не найден, пропускаем установку Webhook');
    return;
  }

  const webhookUrl = `https://${VERCEL_URL}/api/webhook`;
  console.log(`Устанавливаем Webhook на: ${webhookUrl}`);

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const data = await res.json();
    
    if (data.ok) {
      console.log('✅ Webhook успешно установлен!');
    } else {
      console.error('❌ Ошибка установки Webhook:', data.description);
    }
  } catch (err) {
    console.error('❌ Ошибка сети при установке Webhook:', err.message);
  }
}

setWebhook();