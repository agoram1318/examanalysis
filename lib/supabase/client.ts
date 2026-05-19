import { createClient as _createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    '[Supabase] NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.\n' +
      '.env.local 파일에 NEXT_PUBLIC_SUPABASE_URL을 추가해주세요.'
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    '[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.\n' +
      '.env.local 파일에 NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가해주세요.'
  )
}

export const supabase = _createClient(supabaseUrl, supabaseAnonKey)
