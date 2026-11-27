import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// Ключи вшиты в код, как в исходной версии (SUPABASE_SECRET_KEY берётся из Vercel)
const BOT_TOKEN = '9282771149:AAG8sfR7iDHAqffvmgvllqOvy-DV0jYIKVY';
const ADMIN_ID = '424175344';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''; // необязательно: если задан, должен совпадать с secret_token из setWebhook
const APP_URL = 'https://cultclubgallery.ru';

const supabaseUrl = 'https://asoljhfvsrxmeniwsvel.supabase.co';
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY);

const tg = (method, payload) =>
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

// Имя файла в бакете photos из публичной ссылки
function storagePathFromUrl(url) {
  const marker = '/object/public/photos/';
  const i = String(url || '').indexOf(marker);
  return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length).split('?')[0]);
}

export async function POST(request) {
  try {
    // 0. Если секрет задан — принимаем запросы только от Telegram (секрет передаётся в setWebhook)
    if (WEBHOOK_SECRET && request.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    if (!BOT_TOKEN || !ADMIN_ID) return NextResponse.json({ ok: true });

    const body = await request.json();

    // 1. /start
    if (body.message && body.message.text === '/start') {
      await tg('sendMessage', {
        chat_id: body.message.chat.id,
        text: 'Привет, переходи в галерею.',
        reply_markup: { inline_keyboard: [[{ text: 'Перейти', web_app: { url: APP_URL } }]] },
      });
      return NextResponse.json({ ok: true });
    }

    // 2. Кнопки модерации — только от администратора
    if (body.callback_query) {
      const cq = body.callback_query;
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;
      if (String(cq.from?.id) !== ADMIN_ID || String(chatId) !== ADMIN_ID) return NextResponse.json({ ok: true });

      await tg('answerCallbackQuery', { callback_query_id: cq.id });

      const m = /^(approve|reject|edit)_([\w-]+)$/.exec(cq.data || '');
      if (!m) return NextResponse.json({ ok: true });
      const [, action, photoId] = m;

      if (action === 'approve') {
        await supabaseAdmin.from('photos').update({ status: 'approved' }).eq('id', photoId);
        await tg('editMessageCaption', {
          chat_id: chatId, message_id: messageId,
          caption: `✅ ОПУБЛИКОВАНО\nID: ${photoId}`,
          reply_markup: { inline_keyboard: [[{ text: '✏️ Редактировать', callback_data: `edit_${photoId}` }]] },
        });
      }

      if (action === 'reject') {
        // Отклонённое удаляем полностью: и файл, и запись
        const { data: row } = await supabaseAdmin.from('photos').select('image_url').eq('id', photoId).maybeSingle();
        const path = storagePathFromUrl(row?.image_url);
        if (path) await supabaseAdmin.storage.from('photos').remove([path]);
        await supabaseAdmin.from('photos').delete().eq('id', photoId);
        await tg('editMessageCaption', {
          chat_id: chatId, message_id: messageId,
          caption: `❌ ОТКЛОНЕНО И УДАЛЕНО\nID: ${photoId}`,
        });
      }

      if (action === 'edit') {
        // Состояние хранится в самом сообщении (ответ на него), а не в памяти: на Vercel память не сохраняется между запросами
        await tg('sendMessage', {
          chat_id: chatId,
          text: `Ответьте на это сообщение новым фото или новым тегом (например, @newname).\nID: ${photoId}`,
          reply_markup: { force_reply: true, selective: true },
        });
      }
      return NextResponse.json({ ok: true });
    }

    // 3. Редактирование: ответ администратора на сообщение с «ID: …»
    const msg = body.message;
    if (msg && String(msg.from?.id) === ADMIN_ID && String(msg.chat?.id) === ADMIN_ID && msg.reply_to_message) {
      const idMatch = /ID:\s*([\w-]+)/.exec(msg.reply_to_message.text || '');
      if (!idMatch) return NextResponse.json({ ok: true });
      const photoId = idMatch[1];
      const chatId = msg.chat.id;

      if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const fileData = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)).json();
        const imgRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`);
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const fileName = `${randomUUID()}.jpg`;

        const { error: uploadError } = await supabaseAdmin.storage.from('photos').upload(fileName, buffer, { contentType: 'image/jpeg' });
        if (!uploadError) {
          const { data: old } = await supabaseAdmin.from('photos').select('image_url').eq('id', photoId).maybeSingle();
          const { data: urlData } = supabaseAdmin.storage.from('photos').getPublicUrl(fileName);
          await supabaseAdmin.from('photos').update({ image_url: urlData.publicUrl }).eq('id', photoId);
          const oldPath = storagePathFromUrl(old?.image_url);
          if (oldPath) await supabaseAdmin.storage.from('photos').remove([oldPath]); // старый файл не оставляем
          await tg('sendMessage', { chat_id: chatId, text: `✅ Фото для ID ${photoId} обновлено!` });
        }
      } else if (msg.text) {
        const newTag = msg.text.trim().replace(/[<>"'`\\&\u0000-\u001f]/g, '').slice(0, 64);
        await supabaseAdmin.from('photos').update({ tag: newTag }).eq('id', photoId);
        await tg('sendMessage', { chat_id: chatId, text: `✅ Тег для ID ${photoId} обновлён на ${newTag}!` });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: true });
  }
}
