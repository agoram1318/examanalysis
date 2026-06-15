import { createClient as _createClient, SupabaseClient } from '@supabase/supabase-js'

// 싱글턴 인스턴스 — 처음 호출될 때 생성됨
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error(
      '[Supabase] NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.\n' +
        'Vercel 대시보드 또는 .env.local에 NEXT_PUBLIC_SUPABASE_URL을 추가해주세요.'
    )
  }
  if (!key) {
    throw new Error(
      '[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.\n' +
        'Vercel 대시보드 또는 .env.local에 NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가해주세요.'
    )
  }

  // 연결 대상 프로젝트 host만 로그 (키 값은 출력하지 않음)
  try {
    const host = new URL(url).host;
    console.info('[Supabase] 연결 프로젝트:', host);
  } catch {
    console.info('[Supabase] URL 파싱 실패 — NEXT_PUBLIC_SUPABASE_URL 형식을 확인해주세요.');
  }

  _client = _createClient(url, key)
  return _client
}

/**
 * Supabase 클라이언트 — 첫 번째 프로퍼티 접근 시 초기화됩니다.
 * 빌드 타임(환경변수 없음)에는 에러가 발생하지 않고,
 * 런타임에 실제로 사용될 때 환경변수를 검증합니다.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getClient()
    const val = Reflect.get(client, prop)
    return typeof val === 'function'
      ? (val as (...args: unknown[]) => unknown).bind(client)
      : val
  },
})
