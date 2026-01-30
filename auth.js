// functions/auth.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid JSON' }) };
  }

  const { action } = body;

  try {
    // Test kết nối db (dùng để check backend sống)
    if (action === 'test') {
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'API running', db_connected: true }) };
    }

    // Check support (dùng cho login để xem user có trong bảng supports không)
    if (action === 'check_support') {
      const { data } = await supabase
        .from('supports')
        .select('*')
        .eq('user_id', body.user_id)
        .single();

      return { statusCode: 200, body: JSON.stringify({ success: !!data, is_support: !!data }) };
    }

    // Check permission (xem user là admin hay support)
    if (action === 'check_permission') {
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('user_id', body.user_id)
        .single();

      const isAdmin = user?.role === 'admin';

      return { statusCode: 200, body: JSON.stringify({
        success: true,
        is_admin: isAdmin,
        app_count: 0,          // sau này query đếm apps thật
        max_apps: 10           // giới hạn giả, sau này lấy từ db
      }) };
    }

    // Tạo key mới (action chính khi admin nhấn Create Key)
    if (action === 'create_key') {
      // Generate key random đơn giản: PREFIX + 10 ký tự random uppercase
      const randomPart = Math.random().toString(36).substring(2, 12).toUpperCase();
      const prefix = body.prefix || 'HOPPER';  // mặc định nếu không truyền prefix
      const newKey = `\( {prefix}- \){randomPart}`;

      // Tính expires_at: hiện tại + số ngày * 86400000 ms
      const days = body.days || 30;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('keys')
        .insert({
          key: newKey,
          api: body.api,                  // api_key của application
          prefix: prefix,
          expires_at: expiresAt,
          device_limit: body.device_limit || 1,
          created_by: body.user_id        // Discord ID của admin tạo key
        });

      if (error) {
        throw error;  // nếu lỗi (ví dụ duplicate key), throw để catch
      }

      return { statusCode: 200, body: JSON.stringify({ success: true, key: newKey }) };
    }

    // Action không hợp lệ
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid action' }) };
  } catch (err) {
    console.error('Error in auth handler:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};