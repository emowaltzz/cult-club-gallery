import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// Положите этот файл в app/api/avatar/route.js
const SUPABASE_URL = 'https://asoljhfvsrxmeniwsvel.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB (клиент присылает уже сжатый JPEG 500x500)

function avatarPathFromUrl(url) {
  const marker = '/object/public/avatars/';
  const i = String(url || '').indexOf(marker);
  return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length).split('?')[0]);
}

export async function POST(request) {
  try {
    if (!SUPABASE_SECRET_KEY) return NextResponse.json({ error: 'Сервис временно недоступен' }, { status: 500 });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    const formData = await request.formData();

    const { data: uid } = await supabaseAdmin.rpc('app_check_session', { p_token: String(formData.get('token') || '') });
    if (!uid) return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });

    const action = String(formData.get('action') || '');
    const { data: profile } = await supabaseAdmin.from('user_profiles').select('avatar_url').eq('user_id', uid).maybeSingle();
    const oldPath = avatarPathFromUrl(profile?.avatar_url);

    if (action === 'remove') {
      await supabaseAdmin.from('user_profiles').upsert({ user_id: uid, avatar_url: null }, { onConflict: 'user_id' });
      if (oldPath) await supabaseAdmin.storage.from('avatars').remove([oldPath]);
      return NextResponse.json({ success: true });
    }

    if (action === 'upload') {
      const file = formData.get('avatar');
      if (!file || typeof file.arrayBuffer !== 'function' || file.size > MAX_AVATAR_SIZE) {
        return NextResponse.json({ error: 'Некорректный файл' }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) {
        return NextResponse.json({ error: 'Нужен JPEG' }, { status: 400 });
      }
      const path = `${uid}/${randomUUID()}.jpg`;
      const { error: upError } = await supabaseAdmin.storage.from('avatars').upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
      if (upError) throw new Error(upError.message);
      const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
      const { error: dbError } = await supabaseAdmin.from('user_profiles').upsert({ user_id: uid, avatar_url: urlData.publicUrl }, { onConflict: 'user_id' });
      if (dbError) { await supabaseAdmin.storage.from('avatars').remove([path]); throw new Error(dbError.message); }
      if (oldPath) await supabaseAdmin.storage.from('avatars').remove([oldPath]);
      return NextResponse.json({ success: true, url: urlData.publicUrl });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    console.error('Avatar API error:', error);
    return NextResponse.json({ error: 'Не удалось сохранить аватар' }, { status: 500 });
  }
}
