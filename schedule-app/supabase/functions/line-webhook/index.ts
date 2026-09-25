// Supabase Edge Function: line-webhook
// LINE公式アカウント（Messaging API）のWebhook受け口。
// 役割:
//   1) 友だち追加(follow) → 連携方法を案内する
//   2) メッセージ(message/text) → アプリで表示した「合言葉(link_code)」を受け取り、
//      その送信者の LINE userId を line_links に紐づける（連携完了）
//
// 必要な Secret（Supabase → Edge Functions → line-webhook の環境変数）:
//   LINE_CHANNEL_SECRET        … 署名検証用（Messaging APIチャネルの Channel secret）
//   LINE_CHANNEL_ACCESS_TOKEN  … 返信用（長期のチャネルアクセストークン）
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY … サーバー権限でDB更新（自動で入る）
//
// LINE Developers 側で、このURLを Webhook URL に設定する:
//   https://<PROJECT_REF>.functions.supabase.co/line-webhook

import { createClient } from 'jsr:@supabase/supabase-js@2'

const LINE_REPLY = 'https://api.line.me/v2/bot/message/reply'

// 署名検証: HMAC-SHA256(channelSecret, rawBody) を base64 して x-line-signature と比較
async function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody)
  )
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return b64 === signature
}

async function reply(replyToken: string, text: string, token: string) {
  await fetch(LINE_REPLY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const secret = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
  const rawBody = await req.text()

  // 署名検証（なりすまし防止）
  const ok = await verifySignature(
    rawBody,
    req.headers.get('x-line-signature'),
    secret
  )
  if (!ok) return new Response('bad signature', { status: 401 })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let body: {
    events?: Array<{
      type: string
      replyToken?: string
      source?: { userId?: string }
      message?: { type?: string; text?: string }
    }>
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response('ok') // 検証(空body)などは200で返す
  }

  const GUIDE =
    'MY SCHEDULE の通知連携です。\nアプリの「LINE通知」に表示される合言葉（英数字）を、そのままこのトークに送ってください。'

  for (const ev of body.events ?? []) {
    const uid = ev.source?.userId
    if (ev.type === 'follow' && ev.replyToken) {
      await reply(ev.replyToken, GUIDE, token)
      continue
    }
    if (ev.type === 'message' && ev.message?.type === 'text' && uid) {
      const code = (ev.message.text ?? '').trim().toUpperCase()
      // 合言葉に一致する未連携の行を探して紐づける
      const { data: row } = await admin
        .from('line_links')
        .select('user_id')
        .eq('link_code', code)
        .maybeSingle()

      if (!row) {
        if (ev.replyToken)
          await reply(
            ev.replyToken,
            `合言葉「${code}」が見つかりませんでした。\n${GUIDE}`,
            token
          )
        continue
      }

      const { error } = await admin
        .from('line_links')
        .update({
          line_user_id: uid,
          link_code: null, // 使い切り
          enabled: true,
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', row.user_id)

      if (ev.replyToken)
        await reply(
          ev.replyToken,
          error
            ? '連携に失敗しました。時間をおいて、もう一度お試しください。'
            : '連携できました🌷\n明日ぶんの予定とやることを、毎晩お届けします。（アプリの「LINE通知」で時刻やオン/オフを変更できます）',
          token
        )
    }
  }

  return new Response('ok')
})
