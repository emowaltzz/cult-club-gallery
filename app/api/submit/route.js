import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Настройки
const supabaseUrl = 'https://asoljhfvsrxmeniwsvel.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = '424175344';

const supabaseAdmin = createClient(
supabaseUrl,
supabaseSecretKey
);

export async function POST(request) {
try {
const data = await request.formData();

const file = data.get('photo');
const tag = data.get('tag');
const description = String(data.get('description') || '').trim();

if (!file || typeof file.arrayBuffer !== 'function' || !tag) {
  return NextResponse.json(
    { error: 'Нет файла или тега' },
    { status: 400 }
  );
}

if (!supabaseSecretKey || !BOT_TOKEN) {
  throw new Error('Не настроены секретные ключи сервера');
}

// 1. Конвертируем файл
const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);

const fileName =
  ${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg;

// 2. Загружаем изображение в Supabase Storage
const { error: uploadError } = await supabaseAdmin.storage
  .from('photos')
  .upload(fileName, buffer, {
    contentType: file.type,
    cacheControl: '3600',
  });

if (uploadError) {
  throw new Error(
    'Ошибка загрузки в Storage: ' + uploadError.message
  );
}

// 3. Получаем публичную ссылку
const { data: urlData } = supabaseAdmin.storage
  .from('photos')
  .getPublicUrl(fileName);

const publicUrl = urlData.publicUrl;

// 4. Сохраняем публикацию вместе с описанием
const { data: dbData, error: dbError } = await supabaseAdmin
  .from('photos')
  .insert([{
    image_url: publicUrl,
    tag: tag,
    description: description,
    status: 'pending'
  }])
  .select()
  .single();

if (dbError) {
  throw new Error(
    'Ошибка базы данных: ' + dbError.message
  );
}

// 5. Отправляем фото в Telegram на модерацию
const telegramFormData = new FormData();

telegramFormData.append('chat_id', CHAT_ID);
telegramFormData.append('photo', file);

telegramFormData.append(
  'caption',
 жаем изображение в Supabase Storage
const { error: uploadError } = await supabaseAdmin.sto);

telegramFormData.append(
'caption',
Новая публикация\nТег: ${tag}\nОписание: ${description || 'Нет описания'}
);
      text: '✅ Опубликовать',
      callback_data: approve_${dbData.id}
    },
    {
      text: '❌ Удалить',
      callback_data: reject_${dbData.id}
    }
  ]]
};

telegramFormData.append(
  'reply_markup',
  JSON.stringify(replyMarkup)
);

const telegramResponse = await fetch(
  https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto,
  {
    method: 'POST',
    body: telegramFormData,
  }
);

const telegramResult = await telegramResponse.json();

if (!telegramResult.ok) {
  console.error('Telegram Error:', telegramResult);
}

return NextResponse.json({
  success: true,
  url: publicUrl,
  id: dbData.id,
  description: dbData.description
});
} catch (error) {
console.error('Server Error:', error.message);

return NextResponse.json(
  { error: error.message },
  { status: 500 }
);
}
}