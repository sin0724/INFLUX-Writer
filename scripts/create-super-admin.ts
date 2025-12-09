import { supabaseAdmin } from '../lib/supabase';
import { hashPassword } from '../lib/auth';

async function createSuperAdmin() {
  try {
    const username = 'admin';
    const password = '1234';
    
    // 비밀번호 해시
    const passwordHash = await hashPassword(password);
    
    // 슈퍼어드민 생성
    const { data, error } = await supabaseAdmin
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash,
        role: 'super_admin',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log('슈퍼어드민 계정이 이미 존재합니다.');
        return;
      }
      throw error;
    }

    console.log('슈퍼어드민 계정이 생성되었습니다.');
    console.log('아이디:', username);
    console.log('비밀번호:', password);
  } catch (error) {
    console.error('슈퍼어드민 생성 오류:', error);
  }
}

createSuperAdmin();

