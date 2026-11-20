import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SUPABASE_URL = 'https://asoljhfvsrxmeniwsvel.supabase.co';
const CHAT_ID = '424175344';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DESCRIPTION_LENGTH = 250;

export async function POST(request) {
try {
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!supabaseSecretKey || !botToken) {
  return NextResponse.json(
    {
      error: 'На сервере не настроены SUPABASE_SECRET_KEY или TELEGRAM_BOT_TOKEN',
    },
    { status: 500 }
  );
}

const formData = await request.formData();
const file = formData.get('photo');
const tag = String(formData.get('tag') || '').trim();

const description = String(formData.get('description') || '')
  .trim()
  .slice(0, MAX_DESCRIPTION_LENGTH);

if (!file || typeof file.arrayBuffer !== 'function' || !tag) {
  return NextResponse.json(
    { error: 'Необходимо выбрать изображение и указать тег' },
    { status: 400 }
  );
}

if (!file.type || !file.type.startsWith('image/')) {
  return NextResponse.json(
    { error: 'Можно загружать только изображения' },
    { status: 400 }
  );
}

if (file.size > MAX_IMAGE_SIZE) {
  return NextResponse.json(
    { error: 'Размер изображения не должен превышать 10 МБ' },
    { status: 400 }
  );
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  supabaseSecretKey
);

const extensionByMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const extension = extensionByMimeType[file.type];

if (!extension) {
  return NextResponse.json(
    { error: 'Поддерживаются JPEG, PNG, WEBP и GIF' },
    { status: 400 }
  );
}

const fileName =ption') || '')
  .trim()
  .slice(0, MAX_DESCRIPTION_
const buffer = Buffer.from(await file.arrayBuffer());

// 1. Загружаем изображение в Supabase Storage
const { error: uploadError } = await supabaseAdmin.storage
  .from('photos')
  .upload(fileName, buffer, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });

if (uploadError) {
  throw new Error(
    Ошибка загрузки в Supabase Storage: ${uploadError.message}
  );
}

// 2. Получаем публичную ссылку
const { data: publicUrlData } = supabaseAdmin.storage
  .from('photos')
  .getPublicUrl(fileName);

const publicUrl = publicUrlData.publicUrl;

// 3. Сохраняем публикацию и описание в базе данных
const { data: dbData, error: dbError } = await supabaseAdmin
  .from('photos')
  .insert({
    image_url: publicUrl,
    tag,
    description,
    status: 'pending',
  })
  .select('id, description')
  .single();

if (dbError) {
  throw new Error(
   ey || !botToken) {
  return NextResponse.json(
    {
    );
}

// 4. Отправляем публикацию в Telegram на модерацию
const telegramFormData = new FormData();

telegramFormData.append('chat_id', CHAT_ID);

telegramFormData.append(
  'photo',
  file,
  file.name || photo.${extension}
);

telegramFormData.append(
  'caption',
  `Новая публикация\nТег: ${tag}\nОписание: ${
    description || 'Нет описания'
  }`
);

const replyMarkup = {
  inline_keyboard: [
    [
      {
        text: '✅ Опубликовать',
        callback_data: approve_${dbData.id},
      },
      {
        text: '❌ Удалить',
        callback_data: reject_${dbData.id},
      },
    ],
  ],
};

telegramFormData.append(
  'reply_markup',
  JSON.stringify(replyMarkup)
);

const telegramResponse = await fetch(
  https://api.telegram.org/bot${botToken}/sendPhoto,
  {
    method: 'POST',
    body: telegramFormData,
  }
);

const telegramResult = await telegramResponse.json();

if (!telegramResponse.ok || !telegramResult.ok) {
  console.error(
    'Telegram sendPhoto error:',
    telegramResult
  );
}

// 5. Возвращаем результат
return NextResponse.json({
  success: true,
  id: dbData.id,
  url: publicUrl,
  description: dbData.description,
  telegramSent: Boolean(
    telegramResponse.ok && telegramResult.ok
  ),
});
} catch (error) {
console.error('Submit API error:', error);

return NextResponse.json(
  {
    error:
      error instanceof Error
        ? error.message
        : 'Внутренняя ошибка сервера',
  },
  { status: 500 }
);
}
}