const BOT_TOKEN = '9282771149:AAG8sfR7iDHAqffvmgvllqOvy-DV0jYIKVY';

// Используем системную переменную Vercel для постоянного домена
const PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

async function setWebhook() {
  if (!PRODUCTION_URL) {
    console.log('⚠️ VERCEL_PROJECT_PRODUCTION_URL не найден. Проверь настройки Vercel.');
    return;
  }

  const webhookUrl = `https://${PRODUCTION_URL}/api/webhook`;
  console.log(`🔗 Устанавливаем Webhook на: ${webhookUrl}`);

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const data = await res.json();
    
    if (data.ok) {
      console.log('✅ Webhook успешно установлен на постоянный домен!');
    } else {
      console.error('❌ Ошибка установки Webhook:', data.description);
    }
  } catch (err) {
    console.error('❌ Ошибка сети:', err.message);
  }
}

setWebhook();ы