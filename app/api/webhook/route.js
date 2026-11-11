import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = '9282771149:AAG8sfR7iDHAqffvmgvllqOvy-DV0jYIKVY';
const ADMIN_ID = 424175344;
const APP_URL = 'https://cult-club-gallery.vercel.app'; // Твой сайт

const supabaseUrl = 'https://asoljhfvsrxmeniwsvel.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

// Хранилище состояний (ожидание нового фото для редактирования)
// В реальном проекте лучше использовать Redis или базу, но для одного админа сойдет и Map
const userStates = new Map();

export async function POST(request) {
  try {
    const body = await request.json();

    // 1. ОБРАБОТКА КОМАНДЫ /start
    if (body.message && body.message.text === '/start') {
      const chatId = body.message.chat.id;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Привет, переходи в галерею.",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Перейти", web_app: { url: APP_URL } }]
            ]
          }
        })
      });
    }

    // 2. ОБРАБОТКА КНОПОК МОДЕРАЦИИ И РЕДАКТИРОВАНИЯ
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const data = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;
      const chatId = callbackQuery.message.chat.id;
      const callbackQueryId = callbackQuery.id;

      if (chatId.toString() === ADMIN_ID.toString()) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackQueryId })
        });

        const [action, photoId] = data.split('_');

        if (action === 'approve') {
          await supabaseAdmin.from('photos').update({ status: 'approved' }).eq('id', photoId);
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: chatId, 
              message_id: messageId, 
              caption: `✅ ОПУБЛИКОВАНО\nID: ${photoId}`,
              reply_markup: {
                inline_keyboard: [[{ text: "✏️ Редактировать", callback_data: `edit_${photoId}` }]]
              }
            })
          });
        } 
        
        if (action === 'reject') {
          await supabaseAdmin.from('photos').update({ status: 'rejected' }).eq('id', photoId);
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: `❌ ОТКЛОНЕНО\nID: ${photoId}` })
          });
        }

        // Нажата кнопка "Редактировать"
        if (action === 'edit') {
          userStates.set(chatId, { editId: photoId });
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `Отправьте новое фото для замены (ID: ${photoId}), или напишите новый тег (например, @newname).`
            })
          });
        }
      }
    }

    // 3. ОБРАБОТКА НОВОГО ФОТО ИЛИ ТЕКСТА (ДЛЯ РЕДАКТИРОВАНИЯ)
    if (body.message && userStates.has(body.message.chat.id) && !body.message.text?.startsWith('/')) {
      const chatId = body.message.chat.id;
      const state = userStates.get(chatId);
      const photoId = state.editId;

      // Если прислали фото
      if (body.message.photo) {
        const fileId = body.message.photo[body.message.photo.length - 1].file_id;
        
        // Получаем ссылку на файл из Telegram
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();
        const filePath = fileData.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

        // Скачиваем картинку
        const imgRes = await fetch(fileUrl);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const fileName = `edited-${Date.now()}.jpg`;

        // Загружаем в Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('photos')
          .upload(fileName, buffer, { contentType: 'image/jpeg' });

        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage.from('photos').getPublicUrl(fileName);
          
          // Обновляем ссылку в базе
          await supabaseAdmin.from('photos').update({ image_url: urlData.publicUrl }).eq('id', photoId);
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: `✅ Фото для ID ${photoId} обновлено!` })
          });
        }
        userStates.delete(chatId);
      }

      // Если прислали текст (новый тег)
      if (body.message.text) {
        const newTag = body.message.text.trim();
        await supabaseAdmin.from('photos').update({ tag: newTag }).eq('id', photoId);
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `✅ Тег для ID ${photoId} обновлен на ${newTag}!` })
        });
        userStates.delete(chatId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: true });
  }
}