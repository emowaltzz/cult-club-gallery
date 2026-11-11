import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- НАСТРОЙКИ ---
const supabaseUrl = 'https://asoljhfvsrxmeniwsvel.supabase.co';
// ВАЖНО: Замени это на свой секретный ключ (sb_secret_...) из Supabase -> Settings -> API
const supabaseSecretKey = 'sb_secret_OOXSk4mR9oD6PBMDRfvxmA_zd1-tz9e'; 

const BOT_TOKEN = '9282771149:AAG8sfR7iDHAqffvmgvllqOvy-DV0jYIKVY';
const CHAT_ID = '424175344';

// Создаем админский клиент (игнорирует RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

export async function POST(request) {
  try {
    const data = await request.formData();
    const file = data.get('photo');
    const tag = data.get('tag');

    if (!file || !tag) {
      return NextResponse.json({ error: 'Нет файла или тега' }, { status: 400 });
    }

    // 1. Конвертируем файл
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;

    // 2. Загружаем в Supabase Storage (используя админский клиент)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('photos')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Storage Error:', uploadError);
      throw new Error('Ошибка загрузки в Storage: ' + uploadError.message);
    }

    // 3. Получаем публичную ссылку
    const { data: urlData } = supabaseAdmin.storage
      .from('photos')
      .getPublicUrl(fileName);
      
    const publicUrl = urlData.publicUrl;

    // 4. Сохраняем в базу данных (используя админский клиент)
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('photos')
      .insert([{ image_url: publicUrl, tag: tag, status: 'pending' }])
      .select()
      .single();

    if (dbError) {
      console.error('DB Error:', dbError);
      throw new Error('Ошибка базы данных: ' + dbError.message);
    }

    // 5. Отправляем в Telegram с кнопками
    const telegramFormData = new FormData();
    telegramFormData.append('chat_id', CHAT_ID);
    telegramFormData.append('photo', file);
    telegramFormData.append('caption', `Новое фото!\nТег: ${tag}\nID: ${dbData.id}`);
    
    const replyMarkup = {
      inline_keyboard: [[
        { text: "✅ Опубликовать", callback_data: `approve_${dbData.id}` },
        { text: "❌ Удалить", callback_data: `reject_${dbData.id}` }
      ]]
    };
    telegramFormData.append('reply_markup', JSON.stringify(replyMarkup));

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: telegramFormData,
    });

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error) {
    console.error('Server Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}