import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MOMO_ENV = Deno.env.get('MOMO_ENV') ?? 'sandbox'
const MOMO_BASE_URL = MOMO_ENV === 'sandbox'
  ? 'https://sandbox.momodeveloper.mtn.com'
  : 'https://proxy.momoapi.mtn.com'

async function getMoMoToken(subscriptionKey: string, apiUser: string, apiKey: string) {
  const credentials = btoa(`${apiUser}:${apiKey}`)
  const res = await fetch(`${MOMO_BASE_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
    body: '', // empty body forces Deno to send Content-Length: 0 (required by MTN)
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`MoMo token error ${res.status}: ${body}`)
  }
  const { access_token } = await res.json()
  return access_token as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { referenceId } = await req.json()
    if (!referenceId || typeof referenceId !== 'string') {
      return new Response(JSON.stringify({ error: 'referenceId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subscriptionKey = Deno.env.get('MOMO_SUBSCRIPTION_KEY') ?? ''
    const apiUser         = Deno.env.get('MOMO_API_USER') ?? ''
    const apiKey          = Deno.env.get('MOMO_API_KEY') ?? ''
    if (!subscriptionKey || !apiUser || !apiKey) throw new Error('MoMo credentials not configured')

    const token = await getMoMoToken(subscriptionKey, apiUser, apiKey)

    const res = await fetch(
      `${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          'Authorization':              `Bearer ${token}`,
          'X-Target-Environment':       MOMO_ENV,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      },
    )

    if (!res.ok) throw new Error(`MoMo status check failed ${res.status}`)

    const data = await res.json()
    // MoMo statuses: PENDING → SUCCESSFUL | FAILED
    return new Response(JSON.stringify({ status: data.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
