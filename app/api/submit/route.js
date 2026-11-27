import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// Ключи вшиты в код, как в исходной версии (SUPABASE_SECRET_KEY берётся из Vercel)
const SUPABASE_URL = 'https://asoljhfvsrxmeniwsvel.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BOT_TOKEN = '9282771149:AAG8sfR7iDHAqffvmgvllqOvy-DV0jYIKVY';
const CHAT_ID = '424175344'; // Админ ID

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DESCRIPTION_LENGTH = 250;
const MAX_TAG_LENGTH = 64;

// Определяем тип по содержимому файла, а не по заголовку от клиента
function detectImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return { mime: 'image/gif', ext: 'gif' };
  return null;
}

export async function POST(request) {
  try {
    if (!SUPABASE_SECRET_KEY) {
      console.error('Submit API: не задан SUPABASE_SECRET_KEY');
      return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 500 });
    }

    const formData = await request.formData();
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

    // Только для вошедших пользователей: проверяем сессию на сервере
    const { data: authorId } = await supabaseAdmin.rpc('app_check_session', { p_token: String(formData.get('token') || '') });
    if (!authorId) {
      return NextResponse.json({ error: 'Войдите в аккаунт, чтобы отправить публикацию' }, { status: 401 });
    }

    const file = formData.get('photo');
    const tag = String(formData.get('tag') || '').trim();
    const description = String(formData.get('description') || '').trim().slice(0, MAX_DESCRIPTION_LENGTH);

    if (!file || typeof file.arrayBuffer !== 'function' || !tag) {
      return NextResponse.json({ error: 'Необходимо выбрать изображение и указать тег' }, { status: 400 });
    }
    if (tag.length > MAX_TAG_LENGTH || /[\u0000-\u001f<>"'`\\&]/.test(tag)) {
      return NextResponse.json({ error: 'Некорректный тег' }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Размер изображения не должен превышать 10 МБ' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const type = detectImageType(buffer);
    if (!type) {
      return NextResponse.json({ error: 'Поддерживаются JPEG, PNG, WEBP и GIF' }, { status: 400 });
    }

    const fileName = `${randomUUID()}.${type.ext}`;

    // 1. Загрузка в Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('photos')
      .upload(fileName, buffer, { contentType: type.mime, cacheControl: '3600', upsert: false });
    if (uploadError) throw new Error(`storage: ${uploadError.message}`);

    const { data: publicUrlData } = supabaseAdmin.storage.from('photos').getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;

    // 2. Запись в базу (статус pending — до проверки модератором)
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('photos')
      .insert({ image_url: publicUrl, tag, description, status: 'pending', user_id: authorId })
      .select('id, description')
      .single();
    if (dbError) {
      await supabaseAdmin.storage.from('photos').remove([fileName]); // не оставляем «осиротевший» файл
      throw new Error(`db: ${dbError.message}`);
    }

    // 3. Отправка на модерацию в Telegram
    const telegramFormData = new FormData();
    telegramFormData.append('chat_id', CHAT_ID);
    telegramFormData.append('photo', new Blob([buffer], { type: type.mime }), `photo.${type.ext}`);
    telegramFormData.append('caption', `Новая публикация\nТег: ${tag}\nАвтор (id): ${authorId}\nОписание: ${description || 'Нет описания'}`);
    telegramFormData.append('reply_markup', JSON.stringify({
      inline_keyboard: [[
        { text: '✅ Опубликовать', callback_data: `approve_${dbData.id}` },
        { text: '❌ Удалить', callback_data: `reject_${dbData.id}` },
      ]],
    }));

    let telegramOk = false;
    try {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: telegramFormData });
      const telegramResult = await telegramResponse.json();
      telegramOk = Boolean(telegramResponse.ok && telegramResult.ok);
      if (!telegramOk) console.error('Telegram sendPhoto error:', telegramResult);
    } catch (e) {
      console.error('Telegram sendPhoto failed:', e);
    }

    return NextResponse.json({ success: true, id: dbData.id, telegramSent: telegramOk });
  } catch (error) {
    // Подробности только в лог, пользователю — общий текст
    console.error('Submit API error:', error);
    return NextResponse.json({ error: 'Не удалось отправить публикацию. Попробуйте позже.' }, { status: 500 });
  }
}
