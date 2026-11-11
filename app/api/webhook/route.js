import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = '9282771149:AAG8sfR7iDHAqffvmgvllqOvy-DV0jYIKVY'; // Твой токен
const ADMIN_ID = 424175344; // Твой ID

// Секретный ключ для обхода RLS при обновлении статуса
const supabaseUrl = 'https://asoljhfvsrxmeniwsvel.supabase.co';
const supabaseSecretKey = 'process.env.SUPABASE_SECRET_KEY; // <--- ВСТАВЬ СЮДА!
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const data = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;
      const chatId = callbackQuery.message.chat.id;
      const callbackQueryId = callbackQuery.id;

      // 1. Проверка на админа
      if (chatId.toString() !== ADMIN_ID.toString()) {
        return NextResponse.json({ ok: true });
      }

      // 2. Убираем "часики" на кнопке в боте
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId })
      });

      // 3. Разбираем данные: "approve_18" -> action="approve", photoId="18"
      const [action, photoId] = data.split('_');

      if (action === 'approve') {
        // Обновляем статус в базе (используя секретный ключ)
        const { error } = await supabaseAdmin
          .from('photos')
          .update({ status: 'approved' })
          .eq('id', photoId);

        if (!error) {
          // Меняем текст сообщения в боте
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              caption: `✅ ОПУБЛИКОВАНО\nID: ${photoId}`
            })
          });
        } else {
            console.error("Ошибка обновления:", error);
        }
      } 
      
      if (action === 'reject') {
        // Меняем статус на 'rejected'
        await supabaseAdmin
          .from('photos')
          .update({ status: 'rejected' })
          .eq('id', photoId);

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            caption: `❌ ОТКЛОНЕНО\nID: ${photoId}`
          })
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: true });
  }
}